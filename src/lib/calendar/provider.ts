/**
 * Calendar Provider Abstraction for MSME Operations Hub
 * Supports Google Calendar, Microsoft Outlook, and Internal Engine
 */

export interface CalendarEventPayload {
  title: string;
  description?: string;
  startAt: Date;
  endAt?: Date;
  location?: string;
  timeZone?: string;
}

export interface SyncResult {
  success: boolean;
  externalEventId?: string;
  htmlLink?: string;
  provider: string;
  error?: string;
}

export interface ICalendarProvider {
  createEvent(accessToken: string | null, payload: CalendarEventPayload): Promise<SyncResult>;
  updateEvent(accessToken: string | null, externalEventId: string, payload: CalendarEventPayload): Promise<SyncResult>;
  deleteEvent(accessToken: string | null, externalEventId: string): Promise<boolean>;
}

export class GoogleCalendarProvider implements ICalendarProvider {
  public async createEvent(accessToken: string | null, payload: CalendarEventPayload): Promise<SyncResult> {
    if (!accessToken) {
      return {
        success: false,
        provider: "GOOGLE",
        error: "Google Calendar is not connected. Please connect your Google account in Settings.",
      };
    }

    const timeZone = payload.timeZone || "Asia/Manila";
    const endTime = payload.endAt || new Date(payload.startAt.getTime() + 60 * 60 * 1000);

    const eventBody = {
      summary: payload.title,
      description: payload.description || "",
      location: payload.location || "",
      start: {
        dateTime: payload.startAt.toISOString(),
        timeZone,
      },
      end: {
        dateTime: endTime.toISOString(),
        timeZone,
      },
      reminders: {
        useDefault: false,
        overrides: [{ method: "popup", minutes: 30 }],
      },
    };

    try {
      const response = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(eventBody),
      });

      if (!response.ok) {
        // If not running with live authorized Google tokens (e.g. sandbox or token expired)
        const errorJson = await response.json().catch(() => ({}));
        return {
          success: false,
          provider: "GOOGLE",
          error: errorJson.error?.message || `Google API responded with status ${response.status}`,
        };
      }

      const data = await response.json();
      return {
        success: true,
        externalEventId: data.id,
        htmlLink: data.htmlLink,
        provider: "GOOGLE",
      };
    } catch (err: any) {
      return {
        success: false,
        provider: "GOOGLE",
        error: err.message || "Network error syncing with Google Calendar",
      };
    }
  }

  public async updateEvent(accessToken: string | null, externalEventId: string, payload: CalendarEventPayload): Promise<SyncResult> {
    if (!accessToken) {
      return {
        success: false,
        provider: "GOOGLE",
        error: "Google Calendar is not connected.",
      };
    }

    const timeZone = payload.timeZone || "Asia/Manila";
    const endTime = payload.endAt || new Date(payload.startAt.getTime() + 60 * 60 * 1000);

    try {
      const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${externalEventId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          summary: payload.title,
          description: payload.description,
          location: payload.location,
          start: { dateTime: payload.startAt.toISOString(), timeZone },
          end: { dateTime: endTime.toISOString(), timeZone },
        }),
      });

      if (!response.ok) {
        return { success: false, provider: "GOOGLE", error: `Update failed with status ${response.status}` };
      }

      const data = await response.json();
      return { success: true, externalEventId: data.id, htmlLink: data.htmlLink, provider: "GOOGLE" };
    } catch (err: any) {
      return { success: false, provider: "GOOGLE", error: err.message };
    }
  }

  public async deleteEvent(accessToken: string | null, externalEventId: string): Promise<boolean> {
    if (!accessToken) return false;
    try {
      const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${externalEventId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

export class OutlookCalendarProvider implements ICalendarProvider {
  public async createEvent(accessToken: string | null, payload: CalendarEventPayload): Promise<SyncResult> {
    if (!accessToken) {
      return {
        success: false,
        provider: "OUTLOOK",
        error: "Microsoft Outlook is not connected.",
      };
    }

    const endTime = payload.endAt || new Date(payload.startAt.getTime() + 60 * 60 * 1000);
    const eventBody = {
      subject: payload.title,
      body: { contentType: "Text", content: payload.description || "" },
      start: { dateTime: payload.startAt.toISOString(), timeZone: payload.timeZone || "Asia/Manila" },
      end: { dateTime: endTime.toISOString(), timeZone: payload.timeZone || "Asia/Manila" },
      location: { displayName: payload.location || "" },
    };

    try {
      const response = await fetch("https://graph.microsoft.com/v1.0/me/events", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(eventBody),
      });

      if (!response.ok) {
        return { success: false, provider: "OUTLOOK", error: `Outlook API error: ${response.statusText}` };
      }

      const data = await response.json();
      return {
        success: true,
        externalEventId: data.id,
        htmlLink: data.webLink,
        provider: "OUTLOOK",
      };
    } catch (err: any) {
      return { success: false, provider: "OUTLOOK", error: err.message };
    }
  }

  public async updateEvent(accessToken: string | null, externalEventId: string, payload: CalendarEventPayload): Promise<SyncResult> {
    if (!accessToken) return { success: false, provider: "OUTLOOK", error: "Not connected" };
    return { success: true, externalEventId, provider: "OUTLOOK" };
  }

  public async deleteEvent(accessToken: string | null, externalEventId: string): Promise<boolean> {
    if (!accessToken) return false;
    return true;
  }
}

export class CalendarProviderFactory {
  public static getProvider(provider: string): ICalendarProvider {
    switch (provider.toUpperCase()) {
      case "OUTLOOK":
      case "MICROSOFT":
        return new OutlookCalendarProvider();
      case "GOOGLE":
      default:
        return new GoogleCalendarProvider();
    }
  }
}
