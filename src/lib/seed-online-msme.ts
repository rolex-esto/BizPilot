import { prisma } from "./prisma";

export async function seedOnlineMsme() {
  // 1. Check if TechHaven Philippines already exists
  let business = await prisma.business.findFirst({
    where: {
      OR: [
        { name: "TechHaven Philippines" },
        { email: "klarisse@techhaven.ph" },
        { ownerName: "Klarisse Tan" },
      ],
    },
  });

  if (business) {
    return business;
  }

  // 2. Create Realistic Online-Based MSME Business
  business = await prisma.business.create({
    data: {
      name: "TechHaven Philippines",
      ownerName: "Klarisse Tan",
      currency: "PHP",
      timezone: "Asia/Manila",
      contactNumber: "+63 917 555 8921",
      email: "klarisse@techhaven.ph",
      address: "Online Operations Hub, Metro Manila (No Retail Storefront)",
      settingsJson: JSON.stringify({
        businessModel: "ONLINE_ONLY",
        hasPhysicalStore: false,
        autoSuggestReplies: true,
        notificationChannel: "EMAIL",
        operatingHours: "Daily 8:00 AM - 10:00 PM",
        fulfillmentOptions: ["MEETUP", "LBC", "COURIER", "DELIVERY"],
        meetupLocations: [
          "SM North EDSA",
          "Trinoma",
          "SM Megamall Building B",
          "MRT Ayala Station",
          "Greenbelt 3",
        ],
        couriers: ["Grab Express", "Lalamove", "Borzo", "LBC Express"],
        acceptedPaymentMethods: ["GCASH", "MAYA", "BANK_TRANSFER", "COD", "CASH"],
        gcashNumber: "0917-555-8921 (Klarisse T.)",
        mayaNumber: "0917-555-8921",
        bdoAccount: "0045-8890-1234 (TechHaven Philippines)",
      }),
    },
  });

  const bId = business.id;

  // 3. Platform Connections
  await prisma.platformConnection.createMany({
    data: [
      {
        businessId: bId,
        platform: "FACEBOOK",
        platformAccountId: "fb_page_techhaven_ph",
        platformAccountName: "TechHaven Philippines FB",
        status: "CONNECTED",
        webhookVerifyToken: "techhaven_fb_token_2026",
        capabilitiesJson: JSON.stringify({ messaging: true, webhooks: true, comments: true }),
        lastSyncAt: new Date(),
      },
      {
        businessId: bId,
        platform: "INSTAGRAM",
        platformAccountId: "ig_techhaven_ph",
        platformAccountName: "@techhaven.ph",
        status: "CONNECTED",
        webhookVerifyToken: "techhaven_ig_token_2026",
        capabilitiesJson: JSON.stringify({ directMessages: true, storyReplies: true }),
        lastSyncAt: new Date(),
      },
      {
        businessId: bId,
        platform: "WHATSAPP",
        platformAccountId: "waba_639175558921",
        platformAccountName: "TechHaven WhatsApp Direct",
        status: "CONNECTED",
        webhookVerifyToken: "techhaven_wa_token_2026",
        capabilitiesJson: JSON.stringify({ cloudApi: true, templateMessages: true }),
        lastSyncAt: new Date(),
      },
      {
        businessId: bId,
        platform: "TIKTOK",
        platformAccountId: "tiktok_techhaven_ph",
        platformAccountName: "@techhavenph",
        status: "PENDING_APPROVAL",
        statusMessage: "Requires official TikTok Developer App review and Enterprise Business verification for direct messaging.",
        capabilitiesJson: JSON.stringify({ directMessages: false, requiresApproval: true }),
        lastSyncAt: null,
      },
    ],
  });

  // 4. Products (8 Realistic Consumer Electronics & Accessories)
  const [
    macbook,
    thinkpad,
    mxMaster,
    keychron,
    ankerCharger,
    baseusHub,
    ugreenStand,
    coolingPad,
  ] = await Promise.all([
    prisma.product.create({
      data: {
        businessId: bId,
        sku: "APP-MBP14-M2",
        name: "MacBook Pro 14\" M2 Pro (16GB RAM, 512GB SSD Space Gray)",
        description: "Apple M2 Pro chip, 14.2-inch Liquid Retina XDR display, MagSafe 3, 100% battery health, official Apple warranty.",
        category: "Laptops",
        price: 89990.0,
        costPrice: 76000.0,
        stockQuantity: 3,
        safetyStockThreshold: 2,
        isActive: true,
      },
    }),
    prisma.product.create({
      data: {
        businessId: bId,
        sku: "LEN-T480-16G",
        name: "Lenovo ThinkPad T480 (Core i5 8th Gen, 16GB RAM, 256GB SSD)",
        description: "Workhorse business laptop with dual hot-swap battery, backlit keyboard, Windows 11 Pro activated. 6 months warranty.",
        category: "Laptops",
        price: 18500.0,
        costPrice: 13000.0,
        stockQuantity: 6,
        safetyStockThreshold: 3,
        isActive: true,
      },
    }),
    prisma.product.create({
      data: {
        businessId: bId,
        sku: "LOG-MX3S-BLK",
        name: "Logitech MX Master 3S Wireless Performance Mouse (Graphite)",
        description: "8K DPI any-surface tracking, quiet clicks, MagSpeed electromagnetic scrolling, Bluetooth + Logi Bolt.",
        category: "Accessories",
        price: 5490.0,
        costPrice: 3800.0,
        stockQuantity: 14,
        safetyStockThreshold: 4,
        isActive: true,
      },
    }),
    prisma.product.create({
      data: {
        businessId: bId,
        sku: "KEY-K2-RGB",
        name: "Keychron K2 V2 Wireless Mechanical Keyboard (RGB Brown)",
        description: "75% compact layout, Mac & Windows keycaps included, Hot-swappable switches, 4000mAh long-lasting battery.",
        category: "Accessories",
        price: 4250.0,
        costPrice: 3000.0,
        stockQuantity: 8,
        safetyStockThreshold: 3,
        isActive: true,
      },
    }),
    prisma.product.create({
      data: {
        businessId: bId,
        sku: "ANK-735-65W",
        name: "Anker 735 65W GaN Fast Wall Charger (3-Port USB-C/A)",
        description: "GaNPrime ultra-compact fast charger compatible with MacBooks, laptops, iPhones, Galaxy, and tablets.",
        category: "Accessories",
        price: 2190.0,
        costPrice: 1350.0,
        stockQuantity: 20,
        safetyStockThreshold: 5,
        isActive: true,
      },
    }),
    prisma.product.create({
      data: {
        businessId: bId,
        sku: "BAS-HUB-8IN1",
        name: "Baseus 8-in-1 USB-C Hub (4K HDMI, 100W PD, SD/TF, RJ45)",
        description: "Multifunctional aluminum dongle with 4K@60Hz HDMI, 100W Power Delivery, Gigabit LAN, and 3x USB 3.0 ports.",
        category: "Accessories",
        price: 1350.0,
        costPrice: 820.0,
        stockQuantity: 15,
        safetyStockThreshold: 5,
        isActive: true,
      },
    }),
    prisma.product.create({
      data: {
        businessId: bId,
        sku: "UGR-STAND-ALU",
        name: "UGREEN Aluminum Ergonomic Foldable Laptop Stand",
        description: "Adjustable 6-level height desktop riser with anti-slip silicone pads. Supports 11-inch to 17.3-inch laptops.",
        category: "Accessories",
        price: 990.0,
        costPrice: 550.0,
        stockQuantity: 25,
        safetyStockThreshold: 5,
        isActive: true,
      },
    }),
    prisma.product.create({
      data: {
        businessId: bId,
        sku: "PAD-RGB-COOL",
        name: "Dual-Fan RGB Gaming & Work Laptop Cooling Pad",
        description: "Dual 140mm silent high-speed fans with dynamic RGB lighting and adjustable ergonomic incline bracket.",
        category: "Accessories",
        price: 1150.0,
        costPrice: 650.0,
        stockQuantity: 10,
        safetyStockThreshold: 3,
        isActive: true,
      },
    }),
  ]);

  // 5. Customers (Multi-Channel Online Discovery)
  const custJuan = await prisma.customer.create({
    data: {
      businessId: bId,
      name: "Juan Dela Cruz",
      primaryPlatform: "FACEBOOK",
      source: "FACEBOOK",
      externalId: "fb_juan_001",
      phone: "0917-111-2222",
      deliveryAddress: "Unit 15B, Legaspi Towers, Makati City",
      leadScore: 90,
      leadStatus: "HOT",
      notes: "Met via Facebook Messenger. Prefers physical meetup at SM Megamall. Cash settlement.",
    },
  });

  const custMaria = await prisma.customer.create({
    data: {
      businessId: bId,
      name: "Maria Santos",
      primaryPlatform: "INSTAGRAM",
      source: "INSTAGRAM",
      externalId: "ig_maria_002",
      handle: "@maria.creatives",
      phone: "0920-333-4444",
      deliveryAddress: "Pueblo de Oro, Cagayan de Oro City, Misamis Oriental",
      leadScore: 95,
      leadStatus: "CONVERTED",
      notes: "Creative director. Purchased MacBook Pro 14\". Fulfilled via LBC shipping.",
    },
  });

  const custAlyssa = await prisma.customer.create({
    data: {
      businessId: bId,
      name: "Alyssa Garcia",
      primaryPlatform: "TIKTOK",
      source: "TIKTOK",
      externalId: "tt_alyssa_003",
      handle: "@alyssag_dev",
      phone: "0919-555-6666",
      deliveryAddress: "Tower 2, High Street South Block, BGC, Taguig City",
      leadScore: 85,
      leadStatus: "HOT",
      notes: "TikTok tech setup inquiry. Ordered Keychron K2 + MX Master 3S via Grab Express (COD).",
    },
  });

  const custPedro = await prisma.customer.create({
    data: {
      businessId: bId,
      name: "Pedro Ramos",
      primaryPlatform: "WHATSAPP",
      source: "WHATSAPP",
      phone: "0918-777-8888",
      deliveryAddress: "Batasan Hills, Quezon City",
      leadScore: 80,
      leadStatus: "CONVERTED",
      notes: "Bought Anker Charger + Baseus Hub. Paid via Maya.",
    },
  });

  const custCamille = await prisma.customer.create({
    data: {
      businessId: bId,
      name: "Camille Mendoza",
      primaryPlatform: "PHONE",
      source: "REFERRAL",
      phone: "0922-888-9999",
      leadScore: 65,
      leadStatus: "NEGOTIATING",
      notes: "Inquiring about multiple Baseus hubs for remote office team.",
    },
  });

  // 6. Conversations & Messages
  const convJuan = await prisma.conversation.create({
    data: {
      businessId: bId,
      customerId: custJuan.id,
      platform: "FACEBOOK",
      externalThreadId: "t_fb_juan_001",
      lastMessagePreview: "Sige po ma'am Klarisse, meetup tayo bukas 3PM sa SM Megamall.",
      unreadCount: 0,
    },
  });

  await prisma.message.createMany({
    data: [
      {
        conversationId: convJuan.id,
        customerId: custJuan.id,
        platform: "FACEBOOK",
        direction: "INBOUND",
        textContent: "Hello po! Available pa po ba yung Lenovo ThinkPad T480?",
        aiClassification: "PRODUCT_INQUIRY",
        sentAt: new Date(Date.now() - 3600000 * 5),
      },
      {
        conversationId: convJuan.id,
        platform: "FACEBOOK",
        direction: "OUTBOUND",
        textContent: "Hi Juan! Yes po, available pa. ₱18,500 unit price, 16GB RAM with dual battery.",
        sentAt: new Date(Date.now() - 3600000 * 4),
      },
      {
        conversationId: convJuan.id,
        customerId: custJuan.id,
        platform: "FACEBOOK",
        direction: "INBOUND",
        textContent: "Pwede po ₱17,500 last price? Meetup sa SM Megamall bukas 3PM, cash payment po.",
        aiClassification: "PRICE_INQUIRY",
        sentAt: new Date(Date.now() - 3600000 * 3),
      },
      {
        conversationId: convJuan.id,
        platform: "FACEBOOK",
        direction: "OUTBOUND",
        textContent: "Deal po Juan! ₱17,500 cash on meetup. See you tomorrow 3:00 PM @ SM Megamall Building B.",
        sentAt: new Date(Date.now() - 3600000 * 2),
      },
    ],
  });

  // 7. Orders & Real-World Fulfillment Scenarios (No Storefront)
  const todayMeetupDate = new Date();
  todayMeetupDate.setHours(15, 0, 0, 0); // Today 3:00 PM

  // Scenario 1: Scheduled Meetup (Lenovo T480 @ SM Megamall, ₱17,500 Cash)
  const orderMeetup = await prisma.order.create({
    data: {
      businessId: bId,
      customerId: custJuan.id,
      conversationId: convJuan.id,
      orderNumber: "ORD-2026-TH01",
      totalAmount: 17500.0,
      originalAmount: 18500.0,
      discountAmount: 1000.0,
      source: "FACEBOOK",
      fulfillmentMethod: "MEETUP",
      meetupLocation: "SM Megamall Building B, Cyberzone",
      meetupSchedule: todayMeetupDate,
      meetupStatus: "SCHEDULED",
      status: "CONFIRMED",
      items: {
        create: [
          {
            productId: thinkpad.id,
            productName: thinkpad.name,
            productSku: thinkpad.sku,
            originalUnitPrice: 18500.0,
            discount: 1000.0,
            unitPrice: 17500.0,
            quantity: 1,
            subtotal: 17500.0,
          },
        ],
      },
      payments: {
        create: [
          {
            businessId: bId,
            customerId: custJuan.id,
            paymentMethod: "CASH",
            amount: 17500.0,
            status: "UNPAID",
            notes: "To be collected in cash during physical meetup.",
          },
        ],
      },
    },
  });

  // Scenario 2: LBC Parcel Shipping (MacBook Pro 14", GCash Paid, Tracking Generated)
  const orderLbc = await prisma.order.create({
    data: {
      businessId: bId,
      customerId: custMaria.id,
      orderNumber: "ORD-2026-TH02",
      totalAmount: 89990.0,
      originalAmount: 89990.0,
      source: "INSTAGRAM",
      fulfillmentMethod: "LBC",
      courier: "LBC Express",
      courierTracking: "LBC-984210984PH",
      deliveryAddress: "Pueblo de Oro, Cagayan de Oro City, Misamis Oriental",
      customerPhone: "0920-333-4444",
      status: "SHIPPED",
      items: {
        create: [
          {
            productId: macbook.id,
            productName: macbook.name,
            productSku: macbook.sku,
            originalUnitPrice: 89990.0,
            unitPrice: 89990.0,
            quantity: 1,
            subtotal: 89990.0,
          },
        ],
      },
      payments: {
        create: [
          {
            businessId: bId,
            customerId: custMaria.id,
            paymentMethod: "GCASH",
            amount: 89990.0,
            referenceNumber: "GC-20260818-882194",
            status: "PAID",
            verifiedAt: new Date(),
          },
        ],
      },
    },
  });

  // Scenario 3: On-Demand Courier Delivery (Grab Express COD, Keychron + MX Master)
  const orderGrab = await prisma.order.create({
    data: {
      businessId: bId,
      customerId: custAlyssa.id,
      orderNumber: "ORD-2026-TH03",
      totalAmount: 9740.0,
      originalAmount: 9740.0,
      source: "TIKTOK",
      fulfillmentMethod: "COURIER",
      courier: "Grab Express",
      deliveryAddress: "Tower 2, High Street South Block, BGC, Taguig City",
      customerPhone: "0919-555-6666",
      status: "CONFIRMED",
      items: {
        create: [
          {
            productId: keychron.id,
            productName: keychron.name,
            productSku: keychron.sku,
            unitPrice: 4250.0,
            quantity: 1,
            subtotal: 4250.0,
          },
          {
            productId: mxMaster.id,
            productName: mxMaster.name,
            productSku: mxMaster.sku,
            unitPrice: 5490.0,
            quantity: 1,
            subtotal: 5490.0,
          },
        ],
      },
      payments: {
        create: [
          {
            businessId: bId,
            customerId: custAlyssa.id,
            paymentMethod: "COD",
            amount: 9740.0,
            status: "UNPAID",
            notes: "Grab Express rider to collect ₱9,740 cash on delivery.",
          },
        ],
      },
    },
  });

  // Scenario 4: Completed Order (Anker Charger + Baseus Hub, Maya Paid)
  const orderCompleted = await prisma.order.create({
    data: {
      businessId: bId,
      customerId: custPedro.id,
      orderNumber: "ORD-2026-TH04",
      totalAmount: 3540.0,
      originalAmount: 3540.0,
      source: "WHATSAPP",
      fulfillmentMethod: "DELIVERY",
      courier: "Lalamove",
      deliveryAddress: "Batasan Hills, Quezon City",
      status: "DELIVERED",
      items: {
        create: [
          {
            productId: ankerCharger.id,
            productName: ankerCharger.name,
            productSku: ankerCharger.sku,
            unitPrice: 2190.0,
            quantity: 1,
            subtotal: 2190.0,
          },
          {
            productId: baseusHub.id,
            productName: baseusHub.name,
            productSku: baseusHub.sku,
            unitPrice: 1350.0,
            quantity: 1,
            subtotal: 1350.0,
          },
        ],
      },
      payments: {
        create: [
          {
            businessId: bId,
            customerId: custPedro.id,
            paymentMethod: "MAYA",
            amount: 3540.0,
            referenceNumber: "MY-992104-883",
            status: "PAID",
            verifiedAt: new Date(Date.now() - 86400000),
          },
        ],
      },
    },
  });

  // 8. Calendar Events Derived from Operations
  await prisma.calendarEvent.createMany({
    data: [
      {
        businessId: bId,
        customerId: custJuan.id,
        orderId: orderMeetup.id,
        title: "🤝 Meetup with Juan Dela Cruz — Lenovo T480",
        description: "Agreed Price: ₱17,500 (Cash settlement on meetup). Bring unit, charger, and warranty receipt.",
        eventType: "CUSTOMER_MEETUP",
        startAt: todayMeetupDate,
        location: "SM Megamall Building B, Cyberzone",
        status: "SCHEDULED",
        sourceType: "ORDER",
        sourceId: orderMeetup.id,
      },
      {
        businessId: bId,
        customerId: custMaria.id,
        orderId: orderLbc.id,
        title: "📦 Drop off LBC shipment — Maria Santos (MacBook Pro 14\")",
        description: "LBC Express Waybill: LBC-984210984PH. Insured package to Cagayan de Oro City.",
        eventType: "LBC_SHIPMENT",
        startAt: new Date(Date.now() + 3600000 * 2),
        status: "SCHEDULED",
        sourceType: "ORDER",
        sourceId: orderLbc.id,
      },
      {
        businessId: bId,
        customerId: custAlyssa.id,
        orderId: orderGrab.id,
        title: "🚚 Dispatch Grab Express — Alyssa Garcia (BGC Taguig)",
        description: "Keychron K2 + MX Master 3S (₱9,740 COD Collection). Book Grab rider once packed.",
        eventType: "DELIVERY",
        startAt: new Date(Date.now() + 3600000 * 4),
        location: "Tower 2, High Street South Block, BGC",
        status: "SCHEDULED",
        sourceType: "ORDER",
        sourceId: orderGrab.id,
      },
      {
        businessId: bId,
        customerId: custCamille.id,
        title: "💬 Follow up with Camille Mendoza on Baseus Hub quote",
        description: "Team discount inquiry for 5 units of Baseus 8-in-1 Hub.",
        eventType: "FOLLOW_UP",
        startAt: new Date(Date.now() + 86400000),
        status: "SCHEDULED",
        sourceType: "CUSTOMER",
        sourceId: custCamille.id,
      },
    ],
  });

  return business;
}
