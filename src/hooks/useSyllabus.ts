import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export interface Chapter {
  id: string;
  name: string;
  is_completed: boolean;
  completed_date: string | null;
  revisions_completed: number;
  subject_id: string;
}

export interface Subject {
  id: string;
  name: string;
  chapters: Chapter[];
}

export function useSyllabus() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!user) return;
    const { data: subjectsData } = await supabase
      .from("subjects")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at");

    const { data: chaptersData } = await supabase
      .from("chapters")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at");

    const subs: Subject[] = (subjectsData || []).map((s: any) => ({
      id: s.id,
      name: s.name,
      chapters: (chaptersData || [])
        .filter((c: any) => c.subject_id === s.id)
        .map((c: any) => ({
          id: c.id,
          name: c.name,
          is_completed: c.is_completed,
          completed_date: c.completed_date,
          revisions_completed: c.revisions_completed,
          subject_id: c.subject_id,
        })),
    }));
    setSubjects(subs);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const addSubject = async (name: string) => {
    if (!user || !name.trim()) return;
    const { error } = await supabase.from("subjects").insert({ user_id: user.id, name: name.trim() });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else await fetchData();
  };

  const deleteSubject = async (id: string) => {
    const { error } = await supabase.from("subjects").delete().eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else await fetchData();
  };

  const addChapter = async (subjectId: string, name: string) => {
    if (!user || !name.trim()) return;
    const { error } = await supabase.from("chapters").insert({
      user_id: user.id,
      subject_id: subjectId,
      name: name.trim(),
    });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else await fetchData();
  };

  const deleteChapter = async (id: string) => {
    const { error } = await supabase.from("chapters").delete().eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else await fetchData();
  };

  const toggleChapter = async (chapter: Chapter) => {
    const newCompleted = !chapter.is_completed;
    const { error } = await supabase
      .from("chapters")
      .update({
        is_completed: newCompleted,
        completed_date: newCompleted ? new Date().toISOString().split("T")[0] : null,
        revisions_completed: newCompleted ? 0 : chapter.revisions_completed,
      })
      .eq("id", chapter.id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else await fetchData();
  };

  const totalChapters = subjects.reduce((a, s) => a + s.chapters.length, 0);
  const completedChapters = subjects.reduce((a, s) => a + s.chapters.filter((c) => c.is_completed).length, 0);

  return {
    subjects,
    loading,
    addSubject,
    deleteSubject,
    addChapter,
    deleteChapter,
    toggleChapter,
    totalChapters,
    completedChapters,
    refetch: fetchData,
  };
}
