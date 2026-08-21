import { prisma } from "../prisma";
import { NormalizedMessageEvent, getCanonicalExternalThreadId } from "./types";
import { AiClassifier } from "../ai/classifier";
import { GroundedAiSuggestor } from "../ai/grounded-suggestor";
import { TokenVault } from "./token-vault";
import { SocialIdentityResolver, isFallbackCustomerName } from "./identity-resolver";
import { RealtimeBroadcaster } from "../realtime/broadcaster";

export interface IngestionResult {
  isDuplicate: boolean;
  messageId?: string;
  conversationId?: string;
  customerId?: string;
  platformConnectionId?: string;
  aiClassification?: string;
  aiSuggestedReply?: string;
  sourceOfTruth?: Record<string, any>;
}

export class MessageHub {
  /**
   * Main entry point for ingesting normalized messages from any channel or simulator.
   * Multi-Account Aware: Routes by platform + externalAccountId to exact PlatformConnection.
   */
  public static async ingestMessage(event: NormalizedMessageEvent): Promise<IngestionResult> {
    let platformConnectionId: string | undefined;
    let rawPageToken: string | null = null;

    // 1. Resolve Target Business & Platform Connection via externalAccountId
    let businessId = event.businessId;

    if (event.externalAccountId) {
      const conn = await prisma.platformConnection.findFirst({
        where: {
          platform: event.platform,
          platformAccountId: event.externalAccountId,
          ...(businessId ? { businessId } : {}),
        },
      });

      if (conn) {
        businessId = conn.businessId;
        platformConnectionId = conn.id;
        if (conn.accessTokenEncrypted) {
          rawPageToken = TokenVault.decrypt(conn.accessTokenEncrypted);
        }
      }
    }

    if (!businessId) {
      throw new Error(`Routing rejected: No registered business or active PlatformConnection found for platform=${event.platform} accountId=${event.externalAccountId || "unknown"}`);
    }

    // 2. Idempotency Check: Prevent duplicate webhook message processing
    if (event.externalMessageId) {
      const existingMessage = await prisma.message.findUnique({
        where: { externalMessageId: event.externalMessageId },
      });
      if (existingMessage) {
        return {
          isDuplicate: true,
          messageId: existingMessage.id,
          conversationId: existingMessage.conversationId,
          customerId: existingMessage.customerId || undefined,
          platformConnectionId,
        };
      }
    }

    // 3. Resolve Environment & Customer Identity (Tenant-Isolated & Environment-Aware)
    const environment = event.environment || (event.senderExternalId?.startsWith("sim_") ? "PRACTICE" : "LIVE");
    const sourceType = event.sourceType || (environment === "PRACTICE" ? "SIMULATOR" : event.platform);

    let customer = await prisma.customer.findFirst({
      where: {
        businessId,
        environment,
        OR: [
          { externalId: event.senderExternalId, primaryPlatform: event.platform },
          { identityLinks: { some: { platform: event.platform, externalId: event.senderExternalId } } },
        ],
      },
    });

    if (!customer) {
      // Resolve best legitimate identity via official Platform Graph API or Webhook
      const resolved = await SocialIdentityResolver.resolveIdentity(event, rawPageToken);

      try {
        customer = await prisma.customer.create({
          data: {
            businessId,
            environment,
            primaryPlatform: event.platform,
            source: environment === "PRACTICE" ? "SIMULATOR" : event.platform,
            externalId: event.senderExternalId,
            name: resolved.name,
            handle: resolved.handle || event.senderHandle,
            avatarUrl: resolved.avatarUrl,
            phone: resolved.phone || event.senderPhone,
            email: resolved.email || event.senderEmail,
            leadScore: 50,
            leadStatus: "WARM",
          },
        });
      } catch {
        // Concurrency collision handler: Another concurrent request created the customer first. Re-fetch.
        customer = await prisma.customer.findFirst({
          where: {
            businessId,
            environment,
            OR: [
              { externalId: event.senderExternalId, primaryPlatform: event.platform },
              { identityLinks: { some: { platform: event.platform, externalId: event.senderExternalId } } },
            ],
          },
        });
      }
    } else if (isFallbackCustomerName(customer.name) && rawPageToken) {
      // Existing customer has a generic fallback ("Facebook User (377892)").
      // Re-query platform Graph API to upgrade to their legitimate display name if available.
      try {
        const resolved = await SocialIdentityResolver.resolveIdentity(event, rawPageToken);
        if (!resolved.isFallback && resolved.name && resolved.name !== customer.name) {
          await prisma.customer.update({
            where: { id: customer.id },
            data: {
              name: resolved.name,
              handle: resolved.handle || customer.handle,
              avatarUrl: resolved.avatarUrl || customer.avatarUrl,
            },
          });
          customer.name = resolved.name;
        }
      } catch {
        // Preserves existing customer state if lookup fails
      }
    }

    if (!customer) {
      throw new Error(`Failed to resolve or create customer record for ${event.platform} sender ${event.senderExternalId}`);
    }

    // 4. Conversation Thread Resolution (Environment-Scoped & Thread-Isolated)
    const externalThreadId = event.externalThreadId || getCanonicalExternalThreadId(event.platform, event.senderExternalId);
    let conversation = await prisma.conversation.findFirst({
      where: {
        businessId,
        customerId: customer.id,
        platform: event.platform,
        environment,
        ...(externalThreadId ? { externalThreadId } : {}),
      },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          businessId,
          customerId: customer.id,
          environment,
          sourceType,
          platform: event.platform,
          externalThreadId,
          status: "ACTIVE",
          unreadCount: 0, // Will be incremented after message creation succeeds
          lastMessageAt: event.timestamp || new Date(),
          lastMessagePreview: event.textContent.substring(0, 120),
        },
      });
    }

    // 4b. Outbound Echo Reconciliation Guard:
    // If an outbound message originated from BizPilot, it was already persisted with an 'outbound_*' ID.
    // Reconcile the provider webhook echo to the existing record instead of creating a duplicate message.
    if (event.direction === "OUTBOUND") {
      const pendingOutbound = await prisma.message.findFirst({
        where: {
          conversationId: conversation.id,
          direction: "OUTBOUND",
          sentAt: { gt: new Date(Date.now() - 120000) }, // Sent within last 2 minutes
          OR: [
            { externalMessageId: event.externalMessageId },
            {
              AND: [
                { externalMessageId: { startsWith: "outbound_" } },
                {
                  OR: [
                    { textContent: event.textContent },
                    ...(event.mediaType ? [{ mediaType: event.mediaType }] : []),
                  ],
                },
              ],
            },
          ],
        },
        orderBy: { sentAt: "desc" },
      });

      if (pendingOutbound) {
        // Upgrade externalMessageId to provider's official platform message ID
        if (event.externalMessageId && pendingOutbound.externalMessageId !== event.externalMessageId) {
          try {
            await prisma.message.update({
              where: { id: pendingOutbound.id },
              data: {
                externalMessageId: event.externalMessageId,
                rawPayload: JSON.stringify({
                  ...(pendingOutbound.rawPayload ? JSON.parse(pendingOutbound.rawPayload) : {}),
                  providerEchoReconciled: true,
                  platformObjectId: event.externalMessageId,
                }),
              },
            });
          } catch {
            // Safe handling if already updated concurrently
          }
        }

        return {
          isDuplicate: true,
          messageId: pendingOutbound.id,
          conversationId: conversation.id,
          customerId: customer.id,
          platformConnectionId,
        };
      }
    }

    // Track whether to update conversation metadata after message creation
    const shouldUpdateConversation = true;

    // 5. AI Processing: Classification and Grounded Response Suggestion
    let classificationResult = null;
    let groundedSuggestion = null;

    if (event.direction === "INBOUND") {
      const activeProducts = await prisma.product.findMany({
        where: { businessId, isActive: true },
        select: { name: true, sku: true, category: true },
      });
      const activeCatalogTokens = activeProducts.flatMap((p) => [
        p.name,
        p.sku,
        p.category,
        ...p.name.split(" ").filter((w) => w.length >= 2),
      ]);

      classificationResult = AiClassifier.classifyMessage(event.textContent, activeCatalogTokens);
      groundedSuggestion = await GroundedAiSuggestor.generateDraftResponse(
        businessId,
        customer.name,
        event.textContent,
        classificationResult
      );

      // Update customer lead status and score dynamically based on AI classification
      if (classificationResult.leadScore > customer.leadScore) {
        await prisma.customer.update({
          where: { id: customer.id },
          data: {
            leadScore: classificationResult.leadScore,
            leadStatus: classificationResult.leadStatus,
          },
        });
      }

      // If purchase intent or product inquiry detected, create or update Lead record
      if (
        classificationResult.intent === "PURCHASE_INTENT" ||
        classificationResult.intent === "AVAILABILITY_INQUIRY" ||
        classificationResult.intent === "PRICE_INQUIRY"
      ) {
        let productId: string | undefined;
        if (groundedSuggestion.sourceOfTruth.productName) {
          const p = await prisma.product.findFirst({
            where: { businessId, name: groundedSuggestion.sourceOfTruth.productName },
          });
          if (p) productId = p.id;
        }

        await prisma.lead.create({
          data: {
            businessId,
            customerId: customer.id,
            environment,
            conversationId: conversation.id,
            interestedProductId: productId,
            detectedIntent: classificationResult.intent,
            intentScore: classificationResult.leadScore,
            estimatedValue: groundedSuggestion.sourceOfTruth.productPrice || null,
            status: "NEW",
            notes: `Auto-detected from ${event.platform} message: "${event.textContent}"`,
          },
        });
      }
    }

    // 6. Resolve Actor Metadata & Persist Normalized Message
    let parsedExistingPayload: any = {};
    if (event.rawPayload) {
      parsedExistingPayload = typeof event.rawPayload === "string" ? JSON.parse(event.rawPayload) : event.rawPayload;
    }

    const isSimulated = environment === "PRACTICE" || event.senderExternalId?.startsWith("sim_") || (event.platform as string) === "MANUAL" || parsedExistingPayload.isPractice === true;
    const actorType = event.direction === "INBOUND" ? "CUSTOMER" : (parsedExistingPayload.actorType || "OWNER");
    const senderRole = event.direction === "INBOUND" ? "CUSTOMER" : (parsedExistingPayload.senderRole || "OWNER");
    const dispatchStatus = event.direction === "INBOUND"
      ? (isSimulated ? "SIMULATED_RECEIVED" : "RECEIVED")
      : (parsedExistingPayload.dispatchStatus || (isSimulated ? "SIMULATED_SENT" : "SENT"));

    const finalRawPayload = {
      ...parsedExistingPayload,
      actorType,
      senderRole,
      dispatchStatus,
      isPractice: isSimulated,
      environment,
      sourceType,
      messageType: event.messageType || (event.mediaUrl ? event.mediaType : "TEXT"),
      mediaMetadata: event.mediaMetadata,
      locationMetadata: event.locationMetadata,
    };

    let message;
    try {
      message = await prisma.message.create({
        data: {
          conversationId: conversation.id,
          customerId: customer.id,
          environment,
          sourceType,
          platform: event.platform,
          externalMessageId: event.externalMessageId,
          direction: event.direction,
          textContent: event.textContent,
          mediaUrl: event.mediaUrl,
          mediaType: event.mediaType,
          rawPayload: JSON.stringify(finalRawPayload),
          aiClassification: classificationResult?.intent,
          aiConfidence: classificationResult?.confidence,
          aiSuggestedReply: groundedSuggestion?.suggestedText,
          isRead: event.direction === "OUTBOUND",
          sentAt: event.timestamp || new Date(),
        },
      });
    } catch (err: any) {
      if (err.code === "P2002" && event.externalMessageId) {
        const existing = await prisma.message.findUnique({
          where: { externalMessageId: event.externalMessageId },
        });
        if (existing) {
          // Duplicate detected — do NOT update conversation unreadCount
          return {
            isDuplicate: true,
            messageId: existing.id,
            conversationId: existing.conversationId,
            customerId: existing.customerId || undefined,
            platformConnectionId,
          };
        }
      }
      throw err;
    }

    // Message was successfully created — now atomically update conversation metadata
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        unreadCount: event.direction === "INBOUND" ? { increment: 1 } : undefined,
        lastMessageAt: event.timestamp || new Date(),
        lastMessagePreview: event.textContent.substring(0, 120),
        status: conversation.status === "OWNER_HANDLING" ? "OWNER_HANDLING" : "ACTIVE",
      },
    });

    // Broadcast event-driven realtime notification to active SSE listeners
    RealtimeBroadcaster.broadcast({
      type: "message.created",
      businessId,
      conversationId: conversation.id,
      messageId: message.id,
      platform: event.platform,
      environment: environment as "LIVE" | "PRACTICE" | "TEST",
      direction: event.direction,
      preview: event.textContent.substring(0, 120),
      senderName: customer.name || "Customer",
      sentAt: (event.timestamp || new Date()).toISOString(),
    });

    return {
      isDuplicate: false,
      messageId: message.id,
      conversationId: conversation.id,
      customerId: customer.id,
      platformConnectionId,
      aiClassification: classificationResult?.intent,
      aiSuggestedReply: groundedSuggestion?.suggestedText,
      sourceOfTruth: groundedSuggestion?.sourceOfTruth,
    };
  }
}
