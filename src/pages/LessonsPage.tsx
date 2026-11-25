import React, { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { api } from "@/lib/api";
import { BookOpen, Search, Loader2 } from "lucide-react";

type Lesson = {
  id: string;
  title: string;
  content: string;
  sourceUrl: string;
  tags: string[];
  questions: string;
  contact: string;
};

type LessonsResponse = {
  lessons: Lesson[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export function LessonsPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const observerTargetRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedSearch(search);
    }, 1000);
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [search]);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
  } = useInfiniteQuery({
    queryKey: ["lessons", debouncedSearch],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await api.api.lessons.$get({
        query: { q: debouncedSearch, page: String(pageParam), limit: "15" },
      });
      if (!res.ok) throw new Error("Failed to load lessons");
      return res.json() as Promise<LessonsResponse>;
    },
    getNextPageParam: (lastPage) => {
      if (lastPage.page < lastPage.totalPages) {
        return lastPage.page + 1;
      }
      return undefined;
    },
    initialPageParam: 1,
  });

  const lessons = data?.pages.flatMap((page) => page.lessons) ?? [];

  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    [hasNextPage, isFetchingNextPage, fetchNextPage],
  );

  useEffect(() => {
    const observer = new IntersectionObserver(handleObserver, {
      rootMargin: "100px",
      threshold: 0.1,
    });

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [handleObserver]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Bài học Kinh Thánh
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Bài học Kinh Thánh hàng ngày từ Tổng Liên Hội{" "}
          </p>
        </div>

        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm bài giảng, chủ đề hoặc câu hỏi..."
            className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-4 py-2.5 text-sm outline-none focus:border-indigo-600 min-h-11"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-56 rounded-2xl bg-white border border-slate-200/70 animate-pulse"
            />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm font-medium text-red-800">
            Không thể tải danh sách bài học
          </p>
          <p className="text-xs text-red-600 mt-1">Vui lòng thử lại sau</p>
        </div>
      ) : lessons.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="text-sm font-medium text-slate-900">
            Không tìm thấy bài nào phù hợp
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Thử thay đổi từ khóa tìm kiếm.
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {lessons.map((lesson) => (
              <Link
                key={lesson.id}
                to={`/lessons/${lesson.id}` as any}
                className="block"
              >
                <div className="rounded-2xl border border-slate-200/80 bg-white p-5 hover:border-indigo-300 transition-all cursor-pointer group">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <span className="font-mono text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">
                        {lesson.id.slice(0, 4)}-{lesson.id.slice(4, 6)}-
                        {lesson.id.slice(6, 8)}
                      </span>
                      <span className="ml-2 text-[11px] font-medium text-slate-500">
                        {lesson.tags[0] ?? ""}
                      </span>
                    </div>
                    <BookOpen className="h-5 w-5 text-slate-400 group-hover:text-indigo-600 transition-colors" />
                  </div>
                  <h2 className="text-base font-bold text-slate-900 leading-tight mb-2 group-hover:text-indigo-600 transition-colors">
                    {lesson.title}
                  </h2>
                  <p className="text-xs text-slate-500 line-clamp-2 mb-4">
                    {lesson.questions.split("?")[0] ?? lesson.title}
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-slate-100">
                    {lesson.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-50 text-slate-600 border border-slate-100"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </Link>
            ))}
          </div>

          <div ref={loadMoreRef} className="flex justify-center py-4">
            {hasNextPage && (
              <div className="flex items-center gap-2 text-slate-500">
                {isFetchingNextPage && (
                  <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
                )}
                <span className="text-sm">
                  {isFetchingNextPage
                    ? "Đang tải thêm..."
                    : "Kéo xuống để tải thêm"}
                </span>
              </div>
            )}
            {!hasNextPage && lessons.length > 0 && (
              <span className="text-sm text-slate-400">
                Đã tải hết {lessons.length} bài học
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
