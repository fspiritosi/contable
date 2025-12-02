import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { Webhook, type WebhookRequiredHeaders } from "svix";
import type { WebhookEvent } from "@clerk/nextjs/server";
import { syncUserOrganizationMembership } from "@/actions/organizations";

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;
  if (!WEBHOOK_SECRET) {
    console.error("Missing CLERK_WEBHOOK_SECRET env var");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const payload = await req.text();
  const headerList = await headers();

  const svixHeaders: WebhookRequiredHeaders = {
    "svix-id": headerList.get("svix-id") ?? "",
    "svix-timestamp": headerList.get("svix-timestamp") ?? "",
    "svix-signature": headerList.get("svix-signature") ?? "",
  };

  if (!svixHeaders["svix-id"] || !svixHeaders["svix-signature"] || !svixHeaders["svix-timestamp"]) {
    return NextResponse.json({ error: "Missing Svix headers" }, { status: 400 });
  }

  const wh = new Webhook(WEBHOOK_SECRET);
  let evt: WebhookEvent;

  try {
    evt = wh.verify(payload, svixHeaders) as WebhookEvent;
  } catch (error) {
    console.error("Invalid Clerk webhook signature", error);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (evt.type) {
      case "organizationMembership.created": {
        const membershipData = evt.data as {
          organization?: { id?: string | null };
          public_user_data?: { user_id?: string | null };
          user_id?: string | null;
        };

        const organizationId = membershipData.organization?.id ?? null;
        const clerkUserId = membershipData.public_user_data?.user_id ?? membershipData.user_id ?? null;

        if (organizationId && clerkUserId) {
          await syncUserOrganizationMembership({
            clerkOrganizationId: organizationId,
            clerkUserId,
          });
        }
        break;
      }
      default:
        break;
    }

    return NextResponse.json({ received: evt.type }, { status: 200 });
  } catch (error) {
    console.error("Failed to process Clerk webhook", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
