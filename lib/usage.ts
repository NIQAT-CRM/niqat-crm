import type { SupabaseClient } from "@supabase/supabase-js";

// تسجيل حدث استخدام في usage_events — fire-and-forget:
// مايعطّلش الواجهة (مفيش await على النتيجة)، ومايكسرش حاجة لو فشل (كل الأخطاء متبلّعة).
// خصوصية: بنسجّل نوع الحدث ومفتاحه المجرّد بس — مفيش محتوى حسّاس.
export function logUsage(
  supabase: SupabaseClient,
  eventType: "action" | "filter",
  eventKey: string,
  context: string
) {
  try {
    supabase.auth.getUser().then(
      ({ data }) => {
        const uid = data?.user?.id;
        if (!uid || !eventKey) return;
        supabase
          .from("usage_events")
          .insert({ user_id: uid, event_type: eventType, event_key: eventKey, context })
          .then(() => {}, () => {});
      },
      () => {}
    );
  } catch {
    /* fire-and-forget — نتجاهل أي خطأ */
  }
}
