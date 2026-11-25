import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { lessonDetailRoute } from '@/router';
import {
  FileText,
  Copy,
  ExternalLink,
  BookOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

type Lesson = {
  id: string;
  title: string;
  content: string;
  sourceUrl: string;
  tags: string[];
  questions: string;
  contact: string;
  searchText?: string | null;
  createdAt?: string;
};

export function LessonDetailPage() {
  const lessonId =
    typeof window !== 'undefined'
      ? (window.location.pathname.match(/\/lessons\/(.*)\.html$/i) || [])[1].replace('.html', '')
      : '';

  const { data: lesson, isLoading, error } = useQuery({
    queryKey: ['lessons', lessonId],
    queryFn: async () => {
      const res = await api.api.lessons[":id"].$get({
        param: { id: lessonId },
      });
      if (!res.ok) throw new Error(`Failed to load lesson: ${res.status}`);
      const json = await res.json();
      return json.lesson ?? json;
    },
    enabled: Boolean(lessonId),
  });

  if (isLoading) {
    return (
      <div className="h-64 rounded-2xl bg-white border border-slate-200/70 animate-pulse" />
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
        <FileText className="mx-auto h-10 w-10 text-slate-400 mb-3" />
        <h2 className="text-base font-bold text-slate-900">Lỗi tải bài giảng</h2>
        <p className="text-xs text-slate-500 mt-1">{error.message}</p>
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
        <FileText className="mx-auto h-10 w-10 text-slate-400 mb-3" />
        <h2 className="text-base font-bold text-slate-900">Bài không tồn tại</h2>
        <p className="text-xs text-slate-500 mt-1">Không tìm thấy bài giảng yêu cầu.</p>
      </div>
    );
  }

  const dateDisplay = `${lesson.id.slice(6, 8)}/${lesson.id.slice(4, 6)}/${lesson.id.slice(0, 4)}`;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">
              {dateDisplay}
            </span>
            <span className="ml-2 text-[11px] font-medium text-slate-500">
              {lesson.tags[0] ?? ''}
            </span>
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 leading-tight">
            {lesson.title}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Lưu trữ · {lesson.tags.join(', ')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              navigator.clipboard.writeText(lesson.sourceUrl);
            }}
          >
            <Copy className="h-4 w-4" /> Sao chép liên kết
          </Button>
          <a
            href={lesson.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline"
          >
            <ExternalLink className="h-3 w-3" /> Xem trên trang web
          </a>
        </div>
      </div>

      <div className="prose prose-sm text-slate-700 max-w-none">
        {lesson.content.split('\n\n').map((para: string, i: number) => (
          <p key={i} className="mb-4 leading-relaxed whitespace-pre-line">
            {para}
          </p>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <h3 className="text-xs font-semibold uppercase text-slate-500 mb-3">
          Câu hỏi thảo luận
        </h3>
        <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
          {lesson.questions}
        </p>
      </div>

      <div className="text-xs text-slate-400 border-t border-slate-200 pt-3 mt-6">
        {lesson.contact}
      </div>
    </div>
  );
}
