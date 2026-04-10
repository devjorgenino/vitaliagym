import { NextResponse } from "next/server";

const NOTION_TOKEN = process.env.NEXT_PUBLIC_NOTION_TOKEN;
const NOTION_DATABASE_ID = process.env.NEXT_PUBLIC_NOTION_DATABASE_ID;
const NOTION_API_URL = "https://api.notion.com/v1";

export async function GET() {
  try {
    const response = await fetch(`${NOTION_API_URL}/databases/${NOTION_DATABASE_ID}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${NOTION_TOKEN}`,
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28",
      },
    });

    const database = await response.json();
    
    return NextResponse.json({ database });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: error.message || "Error" },
      { status: 500 }
    );
  }
}