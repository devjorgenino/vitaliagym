import { NextResponse } from "next/server";

const NOTION_WEBHOOK_SECRET = process.env.NOTION_WEBHOOK_SECRET;

export async function POST(request) {
  try {
    const signature = request.headers.get("x-notion-webhook-signature");
    
    if (NOTION_WEBHOOK_SECRET && signature !== NOTION_WEBHOOK_SECRET) {
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { type, data: workoutData } = body;

    console.log("Notion webhook received:", type);

    switch (type) {
      case "page.created":
        console.log("New workout created in Notion:", workoutData?.id);
        break;
      case "page.updated":
        console.log("Workout updated in Notion:", workoutData?.id);
        break;
      case "page.deleted":
        console.log("Workout deleted in Notion:", workoutData?.id);
        break;
      default:
        console.log("Unknown webhook event:", type);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: error.message || "Error processing webhook" },
      { status: 500 }
    );
  }
}