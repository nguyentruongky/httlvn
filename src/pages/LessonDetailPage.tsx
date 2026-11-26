import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { lessonDetailRoute, lessonsRoute } from '@/router';
import { useNavigate } from '@tanstack/react-router';
import {
  FileText,
  BookOpen,
} from 'lucide-react';

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

const tagColors = [
  'bg-indigo-100 text-indigo-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-violet-100 text-violet-700',
  'bg-cyan-100 text-cyan-700',
  'bg-orange-100 text-orange-700',
  'bg-pink-100 text-pink-700',
];

function getTagColor(tag: string): string {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  }
  return tagColors[Math.abs(hash) % tagColors.length];
}

export function LessonDetailPage() {
  const { lessonId } = lessonDetailRoute.useParams();
  const navigate = useNavigate();

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

  const formattedContent = lesson.content
    .split('\n\n')
    .map((para: string) => {
      let formatted = para;
      formatted = formatted.replace(/Giô-suê\s+(\d+:\d+(?:-\d+)?)/g, 'Kinh Thánh: Giô-suê $1');
      return formatted;
    })
    .join('\n\n');

  const handleTagClick = (tag: string) => {
    navigate({ to: '/lessons', search: { q: tag } });
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">
            {dateDisplay}
          </span>
        </div>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 leading-tight">
          {lesson.title}
        </h1>
        {lesson.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {lesson.tags.map((tag, i) => (
              <button
                key={tag}
                onClick={() => handleTagClick(tag)}
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTagColor(tag)} hover:opacity-80 transition-opacity cursor-pointer`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="prose prose-sm text-slate-700 max-w-none">
        {formattedContent.split('\n\n').map((para: string, i: number) => (
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
