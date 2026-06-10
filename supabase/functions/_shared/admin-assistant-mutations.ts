// Mutations the admin assistant can execute. Each kind takes a params object
// validated at call time and returns a result. The chat endpoint NEVER executes
// these directly — they only run from `admin-assistant-apply` after the admin
// approves a proposal in the UI.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export type MutationKind =
  | "toggle_pregunta"
  | "bulk_toggle_preguntas"
  | "asignar_pregunta_comedores"
  | "crear_pregunta"
  | "editar_pregunta"
  | "eliminar_pregunta"
  | "toggle_comedor"
  | "crear_comedor"
  | "editar_comedor"
  | "publicar_reporte"
  | "despublicar_reporte"
  | "eliminar_reporte"
  | "asignar_comedores_cliente";

export const MUTATION_KINDS: MutationKind[] = [
  "toggle_pregunta",
  "bulk_toggle_preguntas",
  "asignar_pregunta_comedores",
  "crear_pregunta",
  "editar_pregunta",
  "eliminar_pregunta",
  "toggle_comedor",
  "crear_comedor",
  "editar_comedor",
  "publicar_reporte",
  "despublicar_reporte",
  "eliminar_reporte",
  "asignar_comedores_cliente",
];

export async function applyMutation(
  supabase: SupabaseClient,
  kind: MutationKind,
  params: Record<string, unknown>,
): Promise<{ ok: true; result: unknown } | { ok: false; error: string }> {
  try {
    switch (kind) {
      case "toggle_pregunta": {
        const id = String(params.id ?? "");
        const activa = Boolean(params.activa);
        const { error } = await supabase.from("preguntas").update({ activa }).eq("id", id);
        if (error) throw error;
        return { ok: true, result: { id, activa } };
      }
      case "bulk_toggle_preguntas": {
        const ids = Array.isArray(params.ids) ? (params.ids as string[]) : [];
        const activa = Boolean(params.activa);
        if (ids.length === 0) return { ok: false, error: "ids vacío" };
        const { error } = await supabase.from("preguntas").update({ activa }).in("id", ids);
        if (error) throw error;
        return { ok: true, result: { count: ids.length, activa } };
      }
      case "asignar_pregunta_comedores": {
        const preguntaId = String(params.pregunta_id ?? "");
        const comedorIds = (params.comedor_ids ?? []) as string[];
        const modo = (params.modo ?? "agregar") as "agregar" | "reemplazar" | "quitar";
        if (!preguntaId) return { ok: false, error: "pregunta_id requerido" };
        if (modo === "reemplazar") {
          await supabase.from("comedor_preguntas").delete().eq("pregunta_id", preguntaId);
          if (comedorIds.length) {
            const { error } = await supabase
              .from("comedor_preguntas")
              .insert(comedorIds.map((c) => ({ pregunta_id: preguntaId, comedor_id: c })));
            if (error) throw error;
          }
        } else if (modo === "quitar") {
          await supabase
            .from("comedor_preguntas")
            .delete()
            .eq("pregunta_id", preguntaId)
            .in("comedor_id", comedorIds);
        } else {
          // agregar (idempotente)
          for (const c of comedorIds) {
            await supabase
              .from("comedor_preguntas")
              .upsert({ pregunta_id: preguntaId, comedor_id: c }, { onConflict: "pregunta_id,comedor_id" });
          }
        }
        return { ok: true, result: { pregunta_id: preguntaId, modo, count: comedorIds.length } };
      }
      case "crear_pregunta": {
        const texto = String(params.texto ?? "").trim();
        const tipo = String(params.tipo ?? "escala_5");
        const activa = params.activa === undefined ? true : Boolean(params.activa);
        const comedorIds = (params.comedor_ids ?? []) as string[];
        if (!texto) return { ok: false, error: "texto requerido" };
        const { data: maxRow } = await supabase
          .from("preguntas")
          .select("orden")
          .order("orden", { ascending: false })
          .limit(1)
          .maybeSingle();
        const orden = ((maxRow?.orden as number | undefined) ?? 0) + 1;
        const { data: inserted, error } = await supabase
          .from("preguntas")
          .insert({ texto, tipo, activa, orden })
          .select("id")
          .single();
        if (error || !inserted) throw error ?? new Error("insert failed");
        if (comedorIds.length) {
          await supabase
            .from("comedor_preguntas")
            .insert(comedorIds.map((c) => ({ pregunta_id: inserted.id, comedor_id: c })));
        }
        return { ok: true, result: { id: inserted.id, texto } };
      }
      case "editar_pregunta": {
        const id = String(params.id ?? "");
        const patch: Record<string, unknown> = {};
        if (typeof params.texto === "string") patch.texto = params.texto;
        if (typeof params.tipo === "string") patch.tipo = params.tipo;
        if (typeof params.activa === "boolean") patch.activa = params.activa;
        const { error } = await supabase.from("preguntas").update(patch).eq("id", id);
        if (error) throw error;
        return { ok: true, result: { id, patch } };
      }
      case "eliminar_pregunta": {
        const id = String(params.id ?? "");
        const { count } = await supabase
          .from("respuestas")
          .select("*", { count: "exact", head: true })
          .eq("pregunta_id", id);
        if ((count ?? 0) > 0) {
          return { ok: false, error: "La pregunta tiene respuestas. Desactívala en lugar de borrarla." };
        }
        const { error } = await supabase.from("preguntas").delete().eq("id", id);
        if (error) throw error;
        return { ok: true, result: { id } };
      }
      case "toggle_comedor": {
        const id = String(params.id ?? "");
        const activo = Boolean(params.activo);
        const { error } = await supabase.from("comedores").update({ activo }).eq("id", id);
        if (error) throw error;
        return { ok: true, result: { id, activo } };
      }
      case "crear_comedor": {
        const nombre = String(params.nombre ?? "").trim();
        const slug = String(params.slug ?? "").trim();
        const empresa_cliente = String(params.empresa_cliente ?? "").trim() || null;
        if (!nombre || !slug) return { ok: false, error: "nombre y slug requeridos" };
        const { data, error } = await supabase
          .from("comedores")
          .insert({ nombre, slug, empresa_cliente, activo: true })
          .select("id, nombre, slug")
          .single();
        if (error) throw error;
        return { ok: true, result: data };
      }
      case "editar_comedor": {
        const id = String(params.id ?? "");
        const patch: Record<string, unknown> = {};
        for (const k of ["nombre", "slug", "empresa_cliente", "activo"]) {
          if (params[k] !== undefined) patch[k] = params[k];
        }
        const { error } = await supabase.from("comedores").update(patch).eq("id", id);
        if (error) throw error;
        return { ok: true, result: { id, patch } };
      }
      case "publicar_reporte": {
        const id = String(params.id ?? "");
        const { error } = await supabase.from("reportes").update({ estado: "publicado" }).eq("id", id);
        if (error) throw error;
        return { ok: true, result: { id, estado: "publicado" } };
      }
      case "despublicar_reporte": {
        const id = String(params.id ?? "");
        const { error } = await supabase.from("reportes").update({ estado: "borrador" }).eq("id", id);
        if (error) throw error;
        return { ok: true, result: { id, estado: "borrador" } };
      }
      case "eliminar_reporte": {
        const id = String(params.id ?? "");
        const { error } = await supabase.from("reportes").delete().eq("id", id);
        if (error) throw error;
        return { ok: true, result: { id } };
      }
      case "asignar_comedores_cliente": {
        const usuarioId = String(params.usuario_id ?? "");
        const comedorIds = (params.comedor_ids ?? []) as string[];
        const modo = (params.modo ?? "reemplazar") as "agregar" | "reemplazar" | "quitar";
        if (!usuarioId) return { ok: false, error: "usuario_id requerido" };
        if (modo === "reemplazar") {
          await supabase.from("usuario_comedores").delete().eq("usuario_id", usuarioId);
          if (comedorIds.length) {
            const { error } = await supabase
              .from("usuario_comedores")
              .insert(comedorIds.map((c) => ({ usuario_id: usuarioId, comedor_id: c })));
            if (error) throw error;
          }
        } else if (modo === "quitar") {
          await supabase
            .from("usuario_comedores")
            .delete()
            .eq("usuario_id", usuarioId)
            .in("comedor_id", comedorIds);
        } else {
          for (const c of comedorIds) {
            await supabase
              .from("usuario_comedores")
              .upsert({ usuario_id: usuarioId, comedor_id: c }, { onConflict: "usuario_id,comedor_id" });
          }
        }
        return { ok: true, result: { usuario_id: usuarioId, modo, count: comedorIds.length } };
      }
      default:
        return { ok: false, error: `Mutación desconocida: ${kind}` };
    }
  } catch (e) {
    console.error("applyMutation error", kind, e);
    return { ok: false, error: (e as Error).message ?? "Error al aplicar" };
  }
}