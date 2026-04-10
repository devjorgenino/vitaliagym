import { NextResponse } from "next/server";

const NOTION_TOKEN = process.env.NEXT_PUBLIC_NOTION_TOKEN;
const NOTION_DATABASE_ID = process.env.NEXT_PUBLIC_NOTION_DATABASE_ID;
const NOTION_API_URL = "https://api.notion.com/v1";

export async function GET(request) {
  try {
    console.log("DEBUG: NOTION_TOKEN:", NOTION_TOKEN?.substring(0, 10));
    console.log("DEBUG: NOTION_DATABASE_ID:", NOTION_DATABASE_ID);
    
    const { searchParams } = new URL(request.url);
    const workoutId = searchParams.get("id");

    if (workoutId) {
      return await getWorkoutById(workoutId);
    }

    const response = await fetch(`${NOTION_API_URL}/search`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${NOTION_TOKEN}`,
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28",
      },
      body: JSON.stringify({
        query: "",
        filter: {
          value: "page",
          property: "object",
        },
        sort: {
          direction: "ascending",
          timestamp: "last_edited_time",
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: error.message || `HTTP ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();

    const normalizeId = (id) => id?.replace(/-/g, '');
    const dbIdNormalized = normalizeId(NOTION_DATABASE_ID);

    const pages = data.results
      ?.filter((page) => {
        const parentId = page.parent?.database_id;
        return page.parent?.type === "database_id" && 
               parentId && normalizeId(parentId) === dbIdNormalized;
      })
      .map((page) => parseWorkoutPage(page)) || [];

    const sorted = pages.sort((a, b) => {
      return (a.properties?.nombre || "").localeCompare(b.properties?.nombre || "");
    });

    return NextResponse.json({ workouts: sorted });
  } catch (error) {
    console.error("Notion API error:", error);
    return NextResponse.json(
      { error: error.message || "Error fetching workouts" },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { nombre, descripcion, ejercicios, duracion, nivel, entrenadore } = body;

    if (!nombre) {
      return NextResponse.json(
        { error: "El nombre es requerido" },
        { status: 400 }
      );
    }

    const properties = {
      Nombre: {
        title: [{ text: { content: nombre } }],
      },
    };

    if (descripcion) {
      properties.Descripcion = {
        rich_text: [{ text: { content: descripcion } }],
      };
    }

    if (ejercicios) {
      properties.Ejercicios = {
        rich_text: [{ text: { content: ejercicios } }],
      };
    }

    if (duracion) {
      properties.Duracion = {
        rich_text: [{ text: { content: duracion.toString() } }],
      };
    }

    if (nivel) {
      properties.Nivel = {
        rich_text: [{ text: { content: nivel } }],
      };
    }

    if (entrenadore) {
      properties.Entrenador = {
        rich_text: [{ text: { content: entrenadore } }],
      };
    }

    const response = await fetch(`${NOTION_API_URL}/pages`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${NOTION_TOKEN}`,
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28",
      },
      body: JSON.stringify({
        parent: { database_id: NOTION_DATABASE_ID },
        properties,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: error.message || `HTTP ${response.status}` },
        { status: response.status }
      );
    }

    const newPage = await response.json();
    const workout = parseWorkoutPage(newPage);

    return NextResponse.json({ workout }, { status: 201 });
  } catch (error) {
    console.error("Notion API error:", error);
    return NextResponse.json(
      { error: error.message || "Error creating workout" },
      { status: 500 }
    );
  }
}

export async function PATCH(request) {
  try {
    const { searchParams } = new URL(request.url);
    const workoutId = searchParams.get("id");

    if (!workoutId) {
      return NextResponse.json(
        { error: "ID del entrenamiento es requerido" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { nombre, descripcion, ejercicios, duracion, nivel } = body;

    const properties = {};

    if (nombre !== undefined) {
      properties.Nombre = {
        title: [{ text: { content: nombre } }],
      };
    }

    if (descripcion !== undefined) {
      properties.Descripcion = {
        rich_text: [{ text: { content: descripcion } }],
      };
    }

    if (ejercicios !== undefined) {
      properties.Ejercicios = {
        rich_text: [{ text: { content: ejercicios } }],
      };
    }

    if (duracion !== undefined) {
      properties.Duracion = {
        rich_text: [{ text: { content: duracion?.toString() || "" } }],
      };
    }

    if (nivel !== undefined) {
      properties.Nivel = {
        rich_text: [{ text: { content: nivel || "" } }],
      };
    }

    const response = await fetch(`${NOTION_API_URL}/pages/${workoutId}`, {
      method: "PATCH",
      headers: {
        "Authorization": `Bearer ${NOTION_TOKEN}`,
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28",
      },
      body: JSON.stringify({ properties }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: error.message || `HTTP ${response.status}` },
        { status: response.status }
      );
    }

    const updatedPage = await response.json();
    const workout = parseWorkoutPage(updatedPage);

    return NextResponse.json({ workout });
  } catch (error) {
    console.error("Notion API error:", error);
    return NextResponse.json(
      { error: error.message || "Error updating workout" },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const workoutId = searchParams.get("id");

    if (!workoutId) {
      return NextResponse.json(
        { error: "ID del entrenamiento es requerido" },
        { status: 400 }
      );
    }

    const response = await fetch(`${NOTION_API_URL}/blocks/${workoutId}`, {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${NOTION_TOKEN}`,
        "Notion-Version": "2022-06-28",
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: error.message || `HTTP ${response.status}` },
        { status: response.status }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Notion API error:", error);
    return NextResponse.json(
      { error: error.message || "Error deleting workout" },
      { status: 500 }
    );
  }
}

async function getWorkoutById(workoutId) {
  const response = await fetch(`${NOTION_API_URL}/pages/${workoutId}`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${NOTION_TOKEN}`,
      "Notion-Version": "2022-06-28",
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    return NextResponse.json(
      { error: error.message || `HTTP ${response.status}` },
      { status: response.status }
    );
  }

  const data = await response.json();
  const workout = parseWorkoutPage(data);

  return NextResponse.json({ workout });
}

function parseWorkoutPage(page) {
  const props = page.properties || {};

  const getRichText = (prop) => {
    if (!prop || !prop.rich_text) return "";
    return prop.rich_text.map((t) => t.plain_text).join("");
  };

  const getTitle = (prop) => {
    if (!prop || !prop.title) return "";
    return prop.title.map((t) => t.plain_text).join("");
  };

  const getSelect = (prop) => {
    if (!prop || !prop.select) return null;
    return prop.select.name;
  };

  const getMultiSelect = (prop) => {
    if (!prop || !prop.multi_select) return [];
    return prop.multi_select.map((s) => s.name);
  };

  const getNumber = (prop) => {
    if (!prop || prop.number === null) return null;
    return prop.number;
  };

  const getPeople = (prop) => {
    if (!prop || !prop.people || prop.people.length === 0) return [];
    return prop.people.map((p) => ({
      id: p.id,
      name: p.name,
    }));
  };

  const getCheckbox = (prop) => {
    if (!prop || prop.checkbox === null) return false;
    return prop.checkbox;
  };

  return {
    id: page.id,
    createdTime: page.created_time,
    lastEditedTime: page.last_edited_time,
    archived: page.archived,
    properties: {
      nombre: getTitle(props.Nombre),
      descripcion: getRichText(props.Descripcion),
      ejercicios: getRichText(props.Ejercicios),
      duracion: getRichText(props.Duracion),
      nivel: getRichText(props.Nivel),
      grupoMuscular: [],
      tipo: null,
      equipamiento: [],
      objetivo: "",
      observaciones: "",
      activo: false,
      entrenadore: getRichText(props.Entrenador) || "",
    },
  };
}