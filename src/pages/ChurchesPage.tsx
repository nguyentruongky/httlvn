import React, { useState, useRef, useMemo, useEffect } from "react";
import {
  useQuery,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
} from "@tanstack/react-query";
import {
  Search,
  MoreVertical,
  MapPin,
  Phone,
  Users,
  GitBranch,
  User,
  Calendar,
  X,
} from "lucide-react";
import * as XLSX from "xlsx";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import {
  cn,
  matchesPrefix,
  displayChurchName,
  displayPastorName,
  capitalize,
} from "@/lib/utils";
import { getUser, isAuthenticated } from "@/lib/auth";

type ChurchItem = {
  id: number;
  stt: number;
  code: string;
  form: string;
  legalType: string;
  autonomy: string | null;
  name: string;
  shortName: string;
  parentChurchId: number | null;
  parentChurchName: string | null;
  regionCode: string;
  regionName: string;
  foundedYear: number | null;
  oldWard: string | null;
  oldAddress: string | null;
  newAddress: string | null;
  newWard: string | null;
  isInHcm: boolean;
  memberCount: number;
  regularAttendanceCount: number;
  note: string | null;
  pastorName: string | null;
  pastorTitle: string | null;
  pastorRole: string | null;
  pastorPhone: string | null;
  affiliatedCount: number;
};

export function ChurchesPage() {
  const queryClient = useQueryClient();
  const [regionFilter, setRegionFilter] = useState("ALL");
  const [formFilter, setFormFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [selectedChurch, setSelectedChurch] = useState<ChurchItem | null>(null);
  const [churchPastors, setChurchPastors] = useState<any[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showPastorManager, setShowPastorManager] = useState(false);
  const [availablePastors, setAvailablePastors] = useState<any[]>([]);
  const [pastorSearch, setPastorSearch] = useState("");
  const [selectedPastorId, setSelectedPastorId] = useState<number | null>(null);
  const [newPastorRole, setNewPastorRole] = useState<
    "Quản nhiệm" | "Kiêm nhiệm" | "Đặc trách" | "Phụ tá"
  >("Quản nhiệm");

  // Edit form state
  const [editName, setEditName] = useState("");
  const [editShortName, setEditShortName] = useState("");
  const [editOldAddress, setEditOldAddress] = useState("");
  const [editNewAddress, setEditNewAddress] = useState("");
  const [editNewWard, setEditNewWard] = useState("");
  const [editFoundedYear, setEditFoundedYear] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editMemberCount, setEditMemberCount] = useState("");
  const [editRegularAttendance, setEditRegularAttendance] = useState("");

  // Create form state
  const [name, setName] = useState("");
  const [form, setForm] = useState<"Chi hội" | "Điểm nhóm" | "Hội nhánh">(
    "Điểm nhóm",
  );
  const [legalType, setLegalType] = useState<"Chính thức" | "Nội bộ">(
    "Chính thức",
  );
  const [autonomy, setAutonomy] = useState<"Tự lập" | "Tự dưỡng">("Tự dưỡng");
  const [regionCode, setRegionCode] = useState<
    "I" | "II" | "III" | "IV" | "V" | "VI"
  >("I");
  const [parentChurchName, setParentChurchName] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newWard, setNewWard] = useState("");
  const [pastorName, setPastorName] = useState("");
  const [pastorRole, setPastorRole] = useState<
    "Quản nhiệm" | "Kiêm nhiệm" | "Đặc trách"
  >("Đặc trách");
  const [pastorPhone, setPastorPhone] = useState("");
  const [memberCount, setMemberCount] = useState("60");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Fetch available pastors for assignment
  const fetchAvailablePastors = async () => {
    try {
      const res = await api.api["giao-pham"].$get({
        query: { limit: "200", q: pastorSearch },
      });
      if (res.ok) {
        const json = await res.json();
        setAvailablePastors(json.pastor ?? []);
      }
    } catch {}
  };

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchAvailablePastors();
    }, 300);
    return () => clearTimeout(timeout);
  }, [pastorSearch]);

  // Pastor assignment mutations
  const addPastorMutation = useMutation({
    mutationFn: async ({
      churchId,
      pastorId,
      role,
    }: {
      churchId: number;
      pastorId: number;
      role: string;
    }) => {
      const res = await api.api.churches[":id"]["pastors"].$post({
        param: { id: String(churchId) },
        json: { pastorId, role, isPrimary: true, assignmentType: "church" },
      });
      if (!res.ok) throw new Error("Failed to add pastor");
      return res.json();
    },
    onSuccess: (_data, vars) => {
      if (selectedChurch && selectedChurch.id === vars.churchId) {
        refreshChurchPastors(vars.churchId);
      }
      queryClient.invalidateQueries({ queryKey: ["churches"] });
      queryClient.invalidateQueries({ queryKey: ["pastor"] });
    },
  });

  const updatePastorAssignmentMutation = useMutation({
    mutationFn: async ({
      churchId,
      assignmentId,
      role,
      isPrimary,
    }: {
      churchId: number;
      assignmentId: number;
      role?: string;
      isPrimary?: boolean;
    }) => {
      const res = await api.api.churches[":id"]["pastors"][
        ":assignmentId"
      ].$patch({
        param: { id: String(churchId), assignmentId: String(assignmentId) },
        json: { role, isPrimary },
      });
      if (!res.ok) throw new Error("Failed to update assignment");
      return res.json();
    },
    onSuccess: (_data, vars) => {
      if (selectedChurch && selectedChurch.id === vars.churchId) {
        refreshChurchPastors(vars.churchId);
      }
      queryClient.invalidateQueries({ queryKey: ["churches"] });
      queryClient.invalidateQueries({ queryKey: ["pastor"] });
    },
  });

  const removePastorMutation = useMutation({
    mutationFn: async ({
      churchId,
      assignmentId,
    }: {
      churchId: number;
      assignmentId: number;
    }) => {
      const res = await api.api.churches[":id"]["pastors"][
        ":assignmentId"
      ].$delete({
        param: { id: String(churchId), assignmentId: String(assignmentId) },
      });
      if (!res.ok) throw new Error("Failed to remove pastor");
      return res.json();
    },
    onSuccess: (_data, vars) => {
      if (selectedChurch && selectedChurch.id === vars.churchId) {
        refreshChurchPastors(vars.churchId);
      }
      queryClient.invalidateQueries({ queryKey: ["churches"] });
      queryClient.invalidateQueries({ queryKey: ["pastor"] });
    },
  });

  const refreshChurchPastors = async (churchId: number) => {
    try {
      const res = await api.api.churches[":id"]["pastors"].$get({
        param: { id: String(churchId) },
      });
      if (res.ok) {
        const json = await res.json();
        setChurchPastors(json.pastors ?? []);
      }
    } catch {}
  };

  useEffect(() => {
    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, []);

  useEffect(() => {
    if (selectedChurch && isEditing) {
      setEditName(selectedChurch.name);
      setEditShortName(selectedChurch.shortName);
      setEditOldAddress(selectedChurch.oldAddress ?? "");
      setEditNewAddress(selectedChurch.newAddress ?? "");
      setEditNewWard(selectedChurch.newWard ?? "");
      setEditFoundedYear(selectedChurch.foundedYear?.toString() ?? "");
      setEditNote(selectedChurch.note ?? "");
      setEditMemberCount(selectedChurch.memberCount.toString());
      setEditRegularAttendance(
        selectedChurch.regularAttendanceCount.toString(),
      );
    }
  }, [selectedChurch, isEditing]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearch(val);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => setDebouncedSearch(val), 250);
  };

  const exportToExcel = () => {
    const rows = churchList.map((ch) => ({
      Mã: ch.code,
      "Tên Hội Thánh": ch.name,
      "Khu vực": ch.regionCode,
      "Hình thức": ch.form,
      "Mục sư": ch.pastorName ?? "",
      "Số thành viên": ch.memberCount,
      "Tín hữu trung tín": ch.regularAttendanceCount,
      "Địa chỉ mới": ch.newAddress ?? "",
      "Phường/Xã": ch.newWard ?? "",
      "Ghi chú": ch.note ?? "",
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Danh bộ Hội Thánh");
    XLSX.writeFile(
      workbook,
      `danh-bo-hoi-thanh-${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  };

  const printList = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>Danh bộ Hội Thánh</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; padding: 24px; }
            h1 { font-size: 18px; margin-bottom: 8px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; font-size: 12px; }
            th { background: #f5f5f5; }
            .subtitle { font-size: 12px; color: #666; margin-bottom: 16px; }
          </style>
        </head>
        <body>
          <h1>Danh bộ Hội Thánh</h1>
          <div class="subtitle">Tổng số: ${totalChurches} cơ sở</div>
          <table>
            <thead>
              <tr>
                <th>Mã</th><th>Tên Hội Thánh</th><th>Khu vực</th><th>Hình thức</th><th>Mục sư</th><th>Số thành viên</th><th>Tín hữu trung tín</th>
              </tr>
            </thead>
            <tbody>
              ${churchList
                .map(
                  (ch) => `<tr>
                    <td>${ch.code}</td>
                    <td>${ch.name}</td>
                    <td>${ch.regionCode}</td>
                    <td>${ch.form}</td>
                    <td>${ch.pastorName ?? ""}</td>
                    <td>${ch.memberCount}</td>
                    <td>${ch.regularAttendanceCount}</td>
                  </tr>`,
                )
                .join("")}
            </tbody>
          </table>
          <script>window.print();</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  type ChurchPage = {
    churches: ChurchItem[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  };

  const { data, isPending, isFetching, fetchNextPage, hasNextPage } =
    useInfiniteQuery<ChurchPage>({
      queryKey: ["churches", regionFilter, formFilter, debouncedSearch],
      queryFn: async ({ pageParam = 1 }) => {
        const res = await api.api.churches.$get({
          query: {
            region: regionFilter,
            form: formFilter,
            limit: "20",
            page: String(pageParam),
            q: debouncedSearch,
          },
        });
        if (!res.ok) throw new Error("Failed to load congregations");
        return (await res.json()) as ChurchPage;
      },
      initialPageParam: 1,
      getNextPageParam: (lastPage: ChurchPage) =>
        lastPage.hasMore ? lastPage.page + 1 : undefined,
    });

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 1.0 },
    );
    const el = loadMoreRef.current;
    if (el) observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, fetchNextPage]);

  const churchList = useMemo(() => {
    const query = debouncedSearch;
    return (data?.pages.flatMap((p) => p.churches) ?? []).filter((church) => {
      if (!query) return true;
      return (
        matchesPrefix(church.name, query) ||
        matchesPrefix(church.pastorName, query) ||
        matchesPrefix(church.parentChurchName, query)
      );
    });
  }, [data, debouncedSearch]);

  const totalChurches =
    data?.pages[data.pages.length - 1]?.total ?? churchList.length;

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await api.api.churches.$post({
        json: {
          name: name.trim(),
          form,
          legalType,
          autonomy: form === "Chi hội" ? autonomy : null,
          regionCode,
          parentChurchName: parentChurchName.trim() || null,
          newAddress: newAddress.trim(),
          newWard: newWard.trim(),
          pastorName: pastorName.trim() || null,
          pastorRole,
          pastorPhone: pastorPhone.trim() || null,
          memberCount: Number(memberCount) || 0,
        },
      });
      if (!res.ok) throw new Error("Failed to create congregation");
      return res.json();
    },
    onSuccess: () => {
      setCreateOpen(false);
      setName("");
      setNewAddress("");
      setNewWard("");
      setPastorName("");
      queryClient.invalidateQueries({ queryKey: ["churches"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["pastor"] });
    },
  });

  const updateMembersMutation = useMutation({
    mutationFn: async ({
      id,
      memberCount,
      regularAttendanceCount,
    }: {
      id: number;
      memberCount: number;
      regularAttendanceCount: number;
    }) => {
      const res = await api.api.churches[":id"].$patch({
        param: { id: String(id) },
        json: { memberCount, regularAttendanceCount },
      });
      if (!res.ok) throw new Error("Failed to update member count");
      return res.json();
    },
    onSuccess: (_data, vars) => {
      if (selectedChurch && selectedChurch.id === vars.id) {
        setSelectedChurch({
          ...selectedChurch,
          memberCount: vars.memberCount,
          regularAttendanceCount: vars.regularAttendanceCount,
        });
      }
      queryClient.invalidateQueries({ queryKey: ["churches"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const updateChurchDetailsMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: number;
      data: {
        name?: string;
        shortName?: string;
        oldAddress?: string | null;
        newAddress?: string;
        newWard?: string;
        foundedYear?: number | null;
        note?: string | null;
        memberCount?: number;
        regularAttendanceCount?: number;
      };
    }) => {
      const res = await api.api.churches[":id"].$patch({
        param: { id: String(id) },
        json: data,
      });
      if (!res.ok) throw new Error("Failed to update congregation details");
      return res.json();
    },
    onSuccess: (_data, vars) => {
      if (selectedChurch && selectedChurch.id === vars.id) {
        setSelectedChurch({
          ...selectedChurch,
          ...vars.data,
        });
      }
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ["churches"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const handleSaveChurch = () => {
    if (!selectedChurch) return;
    updateChurchDetailsMutation.mutate({
      id: selectedChurch.id,
      data: {
        name: editName.trim() || undefined,
        shortName: editShortName.trim() || undefined,
        oldAddress: editOldAddress.trim() || null,
        newAddress: editNewAddress.trim() || undefined,
        newWard: editNewWard.trim() || undefined,
        foundedYear: editFoundedYear ? Number(editFoundedYear) : null,
        note: editNote.trim() || null,
        memberCount: editMemberCount ? Number(editMemberCount) : undefined,
        regularAttendanceCount: editRegularAttendance
          ? Number(editRegularAttendance)
          : undefined,
      },
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Danh bộ Hội Thánh ({totalChurches})
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Chi hội, Hội nhánh & Điểm nhóm trực thuộc - Kèm địa chỉ cũ & sau sáp
            nhập 2026
          </p>
        </div>

        <Button size="icon" variant="outline" onClick={() => setMenuOpen(true)}>
          <MoreVertical className="h-5 w-5" />
        </Button>
      </div>

      {/* Action Menu */}
      <ResponsiveSheet
        open={menuOpen}
        onOpenChange={setMenuOpen}
        title="Hành động"
      >
        <div className="space-y-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              exportToExcel();
              setMenuOpen(false);
            }}
            className="w-full text-left justify-between"
          >
            <span>Xuất Excel</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              printList();
              setMenuOpen(false);
            }}
            className="w-full text-left justify-between"
          >
            <span>In danh sách</span>
          </Button>
        </div>
      </ResponsiveSheet>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          type="search"
          value={search}
          onChange={handleSearchChange}
          placeholder="Tìm tên Hội Thánh, Mục sư quản nhiệm, phường/xã mới hoặc địa chỉ..."
          className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-sm outline-none focus:border-indigo-600 min-h-[44px]"
        />
      </div>

      {/* Region & Form Filter Pills */}
      <div className="space-y-2">
        <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] &::-webkit-scrollbar:[hidden]">
          {["ALL", "I", "II", "III", "IV", "V", "VI"].map((kv) => (
            <button
              key={kv}
              type="button"
              onClick={() => setRegionFilter(kv)}
              className={cn(
                "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer min-h-[34px]",
                regionFilter === kv
                  ? "bg-slate-900 text-white"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100",
              )}
            >
              {kv === "ALL" ? "Tất cả KV" : `Khu vực ${kv}`}
            </button>
          ))}
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] &::-webkit-scrollbar:[hidden]">
          {["ALL", "Chi hội", "Điểm nhóm", "Hội nhánh"].map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFormFilter(f)}
              className={cn(
                "shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-all cursor-pointer min-h-[32px]",
                formFilter === f
                  ? "bg-slate-900 text-white"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50",
              )}
            >
              {f === "ALL" ? "Mọi hình thức" : f}
            </button>
          ))}
        </div>
      </div>

      {/* Congregation Cards */}
      {(isPending || isFetching) && churchList.length === 0 ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-28 rounded-2xl bg-white border border-slate-200/70 animate-pulse"
            />
          ))}
        </div>
      ) : churchList.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-sm font-medium text-slate-900">
            Không tìm thấy cơ sở phù hợp
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Thử thay đổi bộ lọc Khu vực hoặc từ khóa tìm kiếm.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {churchList.map((ch) => (
            <div
              key={ch.id}
              onClick={async () => {
                setSelectedChurch(ch);
                setIsEditing(false);
                try {
                  const res = await api.api.churches[":id"]["pastors"].$get({
                    param: { id: String(ch.id) },
                  });
                  if (res.ok) {
                    const json = await res.json();
                    setChurchPastors(json.pastors ?? []);
                  }
                } catch {}
              }}
              className="rounded-2xl border border-slate-200/80 bg-white p-4 hover:border-indigo-300 transition-all active:scale-[0.99] cursor-pointer"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-mono text-[11px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                      KV {ch.regionCode}
                    </span>
                    <span
                      className={cn(
                        "rounded-md px-2 py-0.5 text-[11px] font-semibold",
                        ch.form === "Chi hội" && "bg-indigo-50 text-indigo-700",
                        ch.form === "Điểm nhóm" && "bg-sky-50 text-sky-700",
                        ch.form === "Hội nhánh" &&
                          "bg-violet-50 text-violet-700",
                      )}
                    >
                      {ch.form}
                    </span>
                    <span
                      className={cn(
                        "rounded-md px-2 py-0.5 text-[11px] font-medium",
                        ch.legalType === "Chính thức"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-amber-50 text-amber-700",
                      )}
                    >
                      {ch.legalType}
                    </span>
                    {ch.autonomy && (
                      <span className="rounded-md bg-slate-900 text-white px-2 py-0.5 text-[10px] font-semibold">
                        {ch.autonomy}
                      </span>
                    )}
                  </div>

                  <h3 className="mt-2 text-base font-bold text-slate-900">
                    {displayChurchName(ch.form, ch.shortName ?? ch.name)}
                  </h3>

                  {ch.parentChurchName && (
                    <p className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-indigo-600">
                      <GitBranch className="h-3.5 w-3.5" />
                      <span>Hội Thánh {capitalize(ch.parentChurchName)}</span>
                    </p>
                  )}

                  <p className="mt-1.5 text-xs text-slate-600 flex items-start gap-1.5">
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400 mt-0.5" />
                    {ch.newAddress || ch.oldAddress ? (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((ch.newAddress || ch.oldAddress) as string)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="cursor-pointer"
                      >
                        {ch.newAddress || ch.oldAddress}
                      </a>
                    ) : (
                      <span>Đang cập nhật địa chỉ</span>
                    )}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <div className="inline-flex items-center gap-1 rounded-xl bg-slate-50 border border-slate-200/80 px-2.5 py-1.5 text-xs font-bold text-slate-900">
                    <Users className="h-3.5 w-3.5 text-indigo-600" />
                    <span>{ch.memberCount.toLocaleString("vi-VN")}</span>
                  </div>
                  {ch.affiliatedCount > 0 && (
                    <p className="mt-1 text-[11px] font-medium text-indigo-600">
                      +{ch.affiliatedCount} ĐN/HN
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-slate-400" />
                  {ch.pastorName ? (
                    <>
                      <strong className="text-slate-800">
                        {displayPastorName(ch.pastorTitle, ch.pastorName)}
                      </strong>
                      {ch.pastorRole && (
                        <span className="ml-1 text-[11px] font-medium text-slate-400">
                          ({ch.pastorRole})
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="italic text-slate-400">
                      Khuyết Quản nhiệm
                    </span>
                  )}
                </span>

                {ch.pastorPhone && (
                  <span className="inline-flex items-center gap-1 font-mono text-[11px] text-slate-600">
                    <Phone className="h-3 w-3 text-slate-400" />
                    <a
                      href={`tel:${ch.pastorPhone}`}
                      className="hover:underline cursor-pointer"
                    >
                      {ch.pastorPhone}
                    </a>
                  </span>
                )}
              </div>
            </div>
          ))}
          {isFetching && churchList.length > 0 && (
            <div className="text-center py-4 text-xs text-slate-500">
              Đang tải thêm…
            </div>
          )}
          <div ref={loadMoreRef} className="h-[1px]" />
        </div>
      )}

      {/* Detail Inspection Drawer/Modal */}
      <ResponsiveSheet
        open={Boolean(selectedChurch)}
        onOpenChange={(open) => !open && setSelectedChurch(null)}
        title={
          selectedChurch
            ? displayChurchName(
                selectedChurch.form,
                selectedChurch.shortName ?? selectedChurch.name,
              )
            : ""
        }
      >
        {selectedChurch && (
          <>
            <div className="space-y-4 text-xs">
              {isAuthenticated() && (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[10px] font-semibold uppercase text-slate-400 tracking-wider">
                    Chi tiết Hội Thánh
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsEditing(true);
                    }}
                  >
                    {isEditing ? "Đang chỉnh sửa..." : "Sửa thông tin"}
                  </Button>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2.5">
                {selectedChurch.legalType !== "Cơ quan" && (
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-slate-400">Pháp lý & Tự trị</p>
                    <p className="mt-1 font-bold text-slate-900">
                      {selectedChurch.legalType}
                      {selectedChurch.autonomy
                        ? ` · ${selectedChurch.autonomy}`
                        : ""}
                    </p>
                  </div>
                )}
                {(selectedChurch.form === "Chi hội" ||
                  selectedChurch.form === "Hội nhánh" ||
                  selectedChurch.form === "Điểm nhóm") && (
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-slate-400">Năm thành lập</p>
                    <p className="mt-1 font-bold text-slate-900 flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5 text-slate-400" />
                      {selectedChurch.foundedYear ?? "Chưa cập nhật"}
                    </p>
                  </div>
                )}
                {(selectedChurch.form === "Chi hội" ||
                  selectedChurch.form === "Hội nhánh" ||
                  selectedChurch.form === "Điểm nhóm") && (
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-slate-400">Khu vực</p>
                    <p className="mt-1 font-bold text-slate-900 flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-slate-400" />
                      {selectedChurch.regionName ?? "Khu vực I"}
                    </p>
                  </div>
                )}
              </div>

              {(selectedChurch.form === "Chi hội" ||
                selectedChurch.form === "Hội nhánh" ||
                selectedChurch.form === "Điểm nhóm") && (
                <div className="rounded-xl border border-slate-200/80 p-3.5 space-y-2">
                  <div>
                    <p className="text-[11px] font-semibold text-indigo-600 uppercase">
                      Địa chỉ sau sáp nhập 2026
                    </p>
                    <p className="mt-0.5 text-sm font-medium text-slate-900">
                      {selectedChurch.newAddress ? (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedChurch.newAddress)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="cursor-pointer"
                        >
                          {selectedChurch.newAddress}
                        </a>
                      ) : (
                        "—"
                      )}
                    </p>
                  </div>

                  {selectedChurch.oldAddress && (
                    <div className="pt-2 border-t border-slate-100">
                      <p className="text-[11px] font-semibold text-slate-400 uppercase">
                        Địa chỉ cũ
                      </p>
                      <p className="mt-0.5 text-slate-700">
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedChurch.oldAddress)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="cursor-pointer"
                        >
                          {selectedChurch.oldAddress}
                        </a>
                      </p>
                    </div>
                  )}
                </div>
              )}

              {(selectedChurch.form === "Chi hội" ||
                selectedChurch.form === "Hội nhánh" ||
                selectedChurch.form === "Điểm nhóm") && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-xl border border-slate-200/80 p-3.5">
                    <p className="text-[11px] font-semibold uppercase text-slate-400">
                      Số tín hữu
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <input
                        type="number"
                        value={selectedChurch.memberCount}
                        onChange={(e) => {
                          const v = Math.max(0, Number(e.target.value) || 0);
                          setSelectedChurch({
                            ...selectedChurch,
                            memberCount: v,
                          });
                          updateMembersMutation.mutate({
                            id: selectedChurch.id,
                            memberCount: v,
                            regularAttendanceCount:
                              selectedChurch.regularAttendanceCount,
                          });
                        }}
                        className="w-full text-lg font-bold text-slate-900 border-none bg-transparent focus:ring-0 text-right appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200/80 p-3.5">
                    <p className="text-[11px] font-semibold uppercase text-slate-400">
                      Tín hữu trung tín
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <input
                        type="number"
                        value={selectedChurch.regularAttendanceCount}
                        onChange={(e) => {
                          const v = Math.max(0, Number(e.target.value) || 0);
                          setSelectedChurch({
                            ...selectedChurch,
                            regularAttendanceCount: v,
                          });
                          updateMembersMutation.mutate({
                            id: selectedChurch.id,
                            memberCount: selectedChurch.memberCount,
                            regularAttendanceCount: v,
                          });
                        }}
                        className="w-full text-lg font-bold text-slate-900 border-none bg-transparent focus:ring-0 text-right"
                      />
                    </div>
                  </div>
                </div>
              )}

              {churchPastors.length > 0 && (
                <div className="rounded-xl border border-slate-200/80 p-3.5 space-y-2">
                  <p className="text-[11px] font-semibold uppercase text-slate-400">
                    Giáo phẩm
                  </p>
                  <div className="space-y-2">
                    {(() => {
                      // Sort: Quản nhiệm first, then by last name
                      const sorted = [...churchPastors].sort((a, b) => {
                        const aIsQuanNhiem = a.role === "Quản nhiệm";
                        const bIsQuanNhiem = b.role === "Quản nhiệm";
                        if (aIsQuanNhiem !== bIsQuanNhiem)
                          return aIsQuanNhiem ? -1 : 1;
                        // Sort by last word of name
                        const aLast = a.name.trim().split(/\s+/).pop() ?? "";
                        const bLast = b.name.trim().split(/\s+/).pop() ?? "";
                        return aLast.localeCompare(bLast, "vi", {
                          sensitivity: "base",
                        });
                      });
                      return sorted.map((p) => (
                        <div
                          key={p.id || p.name}
                          className="flex items-center justify-between gap-3 rounded-lgbg-white py-3 transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            <User className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                            <div>
                              {p.title ? (
                                <div className="text-[11px] text-slate-500">
                                  {p.title}
                                </div>
                              ) : null}
                              <div className="text-sm font-medium text-slate-900">
                                {p.name}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="shrink-0 rounded bg-white border border-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                              {p.role}
                            </span>
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              )}
            </div>
            <div className={isEditing ? "" : "hidden"}>
              <div className="rounded-xl border border-slate-200/80 p-4 space-y-4 mt-4">
                <h3 className="text-sm font-semibold text-slate-900">
                  Chỉnh sửa thông tin
                </h3>
                <div className="space-y-3">
                  <div className="flex gap-3 items-end">
                    <div className="flex-1 min-w-0">
                      <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-1">
                        Tên Hội Thánh/Điểm nhóm
                      </label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-600"
                      />
                    </div>
                    <div className="w-35 shrink-0">
                      <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-1">
                        Năm thành lập
                      </label>
                      <input
                        type="number"
                        value={editFoundedYear}
                        onChange={(e) => setEditFoundedYear(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-600 appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>
                  </div>
                  <div className="flex gap-3 items-end">
                    <div className="flex-1 min-w-0">
                      <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-1">
                        Địa chỉ mới (2026)
                      </label>
                      <input
                        type="text"
                        value={editNewAddress}
                        onChange={(e) => setEditNewAddress(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-600"
                      />
                    </div>
                    <div className="w-[140px] shrink-0">
                      <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-1">
                        Phường / Xã
                      </label>
                      <input
                        type="text"
                        value={editNewWard}
                        onChange={(e) => setEditNewWard(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-600"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-1">
                      Địa chỉ cũ
                    </label>
                    <input
                      type="text"
                      value={editOldAddress}
                      onChange={(e) => setEditOldAddress(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-600"
                    />
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-1">
                        Số tín hữu
                      </label>
                      <input
                        type="number"
                        value={editMemberCount}
                        onChange={(e) => setEditMemberCount(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-600 appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-1">
                        Tín hữu trung tín
                      </label>
                      <input
                        type="number"
                        value={editRegularAttendance}
                        onChange={(e) =>
                          setEditRegularAttendance(e.target.value)
                        }
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-600 appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-1">
                      Ghi chú
                    </label>
                    <textarea
                      value={editNote}
                      onChange={(e) => setEditNote(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-600 min-h-20"
                    />
                  </div>

                  {/* Pastor Manager */}
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-1 mt-6">
                      Giáo phẩm phụ trách
                    </label>
                    <div className="space-y-3 border-slate-100 pt-3">
                      {/* Current assignments */}
                      {churchPastors.length > 0 && (
                        <div>
                          <div className="space-y-1.5">
                            {churchPastors.map((p) => (
                              <div
                                key={p.id || p.name}
                                className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white p-2.5"
                              >
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <User className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium text-slate-900 truncate">
                                      {p.title ? `${p.title} ` : ""}
                                      {p.name}
                                    </p>
                                    <p className="text-[11px] text-slate-500">
                                      {p.role}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  {p.role !== "Quản nhiệm" && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() =>
                                        updatePastorAssignmentMutation.mutate({
                                          churchId: selectedChurch!.id,
                                          assignmentId: p.id,
                                          role: "Quản nhiệm",
                                          isPrimary: true,
                                        })
                                      }
                                      disabled={
                                        updatePastorAssignmentMutation.isPending
                                      }
                                      className="text-[10px] px-2 py-1"
                                    >
                                      Làm QN
                                    </Button>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      removePastorMutation.mutate({
                                        churchId: selectedChurch!.id,
                                        assignmentId: p.id,
                                      })
                                    }
                                    disabled={removePastorMutation.isPending}
                                    className="text-red-600 hover:text-red-700 p-1"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Add new pastor */}
                      <div className=" border-slate-100 pt-3">
                        <p className="text-[11px] font-semibold uppercase text-slate-400 mb-2">
                          Thêm mới
                        </p>
                        <div className="space-y-2">
                          <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                            <input
                              type="search"
                              value={pastorSearch}
                              onChange={(e) => setPastorSearch(e.target.value)}
                              placeholder="Tìm tên Mục sư, Truyền đạo..."
                              className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-4 py-2 text-sm outline-none focus:border-indigo-600 min-h-10"
                            />
                          </div>
                          {availablePastors.length > 0 && (
                            <div className="max-h-48 overflow-y-auto space-y-1 mt-4 scrollbar-none &::-webkit-scrollbar:[hidden]">
                              {availablePastors
                                .filter(
                                  (ap) =>
                                    !churchPastors.some(
                                      (cp) =>
                                        cp.id === ap.id || cp.name === ap.name,
                                    ),
                                )
                                .map((ap) => (
                                  <button
                                    key={ap.id || ap.name}
                                    type="button"
                                    onClick={() => {
                                      setSelectedPastorId(ap.id ?? null);
                                    }}
                                    className={cn(
                                      "w-full text-left rounded-lg p-2.5 transition-colors",
                                      selectedPastorId === ap.id
                                        ? "border-indigo-500 bg-indigo-50"
                                        : "border-slate-200 hover:bg-slate-50",
                                    )}
                                  >
                                    <div className="font-medium text-sm text-slate-900">
                                      {ap.title ? `${ap.title} ` : ""}
                                      {ap.name}
                                    </div>
                                    <div className="text-[11px] text-slate-500">
                                      {ap.chucVu || "—"}
                                      {ap.assignments.length > 0 &&
                                        ` · ${ap.assignments[0].churchName}`}
                                    </div>
                                  </button>
                                ))}
                            </div>
                          )}
                          {selectedPastorId && (
                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                              <select
                                value={newPastorRole}
                                onChange={(e) =>
                                  setNewPastorRole(
                                    e.target.value as
                                      | "Quản nhiệm"
                                      | "Kiêm nhiệm"
                                      | "Đặc trách"
                                      | "Phụ tá",
                                  )
                                }
                                className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-600"
                              >
                                <option value="Quản nhiệm">Quản nhiệm</option>
                                <option value="Kiêm nhiệm">Kiêm nhiệm</option>
                                <option value="Đặc trách">Đặc trách</option>
                                <option value="Phụ tá">Phụ tá</option>
                              </select>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedPastorId(null);
                                  setPastorSearch("");
                                }}
                              >
                                Hủy
                              </Button>
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => {
                                  if (!selectedChurch) return;
                                  addPastorMutation.mutate({
                                    churchId: selectedChurch.id,
                                    pastorId: selectedPastorId!,
                                    role: newPastorRole,
                                  });
                                  setSelectedPastorId(null);
                                  setPastorSearch("");
                                }}
                                disabled={addPastorMutation.isPending}
                              >
                                {addPastorMutation.isPending
                                  ? "Đang thêm..."
                                  : "Thêm"}
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Save/Cancel buttons at bottom */}
                  <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsEditing(false)}
                    >
                      Hủy
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleSaveChurch}
                      disabled={updateChurchDetailsMutation.isPending}
                    >
                      {updateChurchDetailsMutation.isPending
                        ? "Đang lưu..."
                        : "Lưu thay đổi"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </ResponsiveSheet>

      {/* Create New Congregation Sheet */}
      <ResponsiveSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Thêm Cơ Sở Hội Thánh Mới"
        description="Đăng ký Chi hội, Hội nhánh hoặc Điểm nhóm vào hệ thống KV TP.HCM."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim() || !newAddress.trim() || !newWard.trim()) return;
            createMutation.mutate();
          }}
          className="space-y-3.5"
        >
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Tên Chi hội / Điểm nhóm
            </label>
            <input
              type="text"
              required
              placeholder="VD: TÂN PHÚ ĐÔNG"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm uppercase outline-none focus:border-indigo-600 min-h-[44px]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Hình thức
              </label>
              <select
                value={form}
                onChange={(e) =>
                  setForm(
                    e.target.value as "Chi hội" | "Điểm nhóm" | "Hội nhánh",
                  )
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-600 min-h-[44px]"
              >
                <option value="Chi hội">Chi hội</option>
                <option value="Điểm nhóm">Điểm nhóm</option>
                <option value="Hội nhánh">Hội nhánh</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Khu vực
              </label>
              <select
                value={regionCode}
                onChange={(e) =>
                  setRegionCode(
                    e.target.value as "I" | "II" | "III" | "IV" | "V" | "VI",
                  )
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-600 min-h-[44px]"
              >
                {["I", "II", "III", "IV", "V", "VI"].map((r) => (
                  <option key={r} value={r}>
                    Khu vực {r}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Loại hình
              </label>
              <select
                value={legalType}
                onChange={(e) =>
                  setLegalType(e.target.value as "Chính thức" | "Nội bộ")
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-600 min-h-[44px]"
              >
                <option value="Chính thức">Chính thức</option>
                <option value="Nội bộ">Nội bộ</option>
              </select>
            </div>

            {form === "Chi hội" ? (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Tự trị
                </label>
                <select
                  value={autonomy}
                  onChange={(e) =>
                    setAutonomy(e.target.value as "Tự lập" | "Tự dưỡng")
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-600 min-h-[44px]"
                >
                  <option value="Tự lập">Tự lập</option>
                  <option value="Tự dưỡng">Tự dưỡng</option>
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Chi hội trực thuộc
                </label>
                <input
                  type="text"
                  placeholder="VD: NGUYỄN TRI PHƯƠNG"
                  value={parentChurchName}
                  onChange={(e) => setParentChurchName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm uppercase outline-none focus:border-indigo-600 min-h-[44px]"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Phường / Xã (Mới 2026)
              </label>
              <input
                type="text"
                required
                placeholder="VD: P. An Đông"
                value={newWard}
                onChange={(e) => setNewWard(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-indigo-600 min-h-[44px]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Số lượng tín hữu
              </label>
              <input
                type="number"
                value={memberCount}
                onChange={(e) => setMemberCount(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-indigo-600 min-h-11 appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1 uppercase">
              Địa chỉ sau sáp nhập 2026
            </label>
            <input
              type="text"
              required
              placeholder="Số nhà, Đường, Phường/Xã, Tp. HCM"
              value={newAddress}
              onChange={(e) => setNewAddress(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-indigo-600 min-h-11"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                MS Quản nhiệm / Đặc trách
              </label>
              <input
                type="text"
                placeholder="Ms Nguyễn Văn A"
                value={pastorName}
                onChange={(e) => setPastorName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-indigo-600 min-h-11"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                SĐT liên lạc
              </label>
              <input
                type="tel"
                placeholder="090..."
                value={pastorPhone}
                onChange={(e) => setPastorPhone(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-indigo-600 min-h-[44px]"
              />
            </div>
          </div>

          <Button type="submit" variant="primary" className="w-full">
            Lưu Cơ Sở Hội Thánh
          </Button>
        </form>
      </ResponsiveSheet>
    </div>
  );
}
