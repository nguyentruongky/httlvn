import React, { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import {
  Search,
  Phone,
  Church,
  Building2,
  MapPin,
  User,
  Users,
  Shield,
  Calendar,
  Mail,
  Edit,
  Save,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import { useMediaQuery } from "@/hooks/use-media-query";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { Button } from "@/components/ui/button";
import {
  displayChurchName,
  displayPastorName,
} from "@/lib/utils";
import { getUser, isAuthenticated } from "@/lib/auth";

type PastorItem = {
  name: string;
  title: string | null;
  phone: string | null;
  email?: string | null;
  chucVu?: string | null;
  namSinh?: number | null;
  tenNhiemSo?: string | null;
  diaChi?: string | null;
  nhuDanh?: string | null;
  status?: string | null;
  assignments: {
    churchId: number | null;
    organizationId: number | null;
    churchName: string;
    form: string;
    regionCode: string;
    role: string;
    memberCount: number;
    source: "db" | "chuc-danh";
    isInHcm: boolean;
    isOtherWork?: boolean;
  }[];
};

export function PastorPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedPerson, setSelectedPerson] = useState<PastorItem | null>(null);
  const [selectedChurch, setSelectedChurch] = useState<any>(null);
  const [churchPastors, setChurchPastors] = useState<any[]>([]);
  const [selectedOrganization, setSelectedOrganization] = useState<any>(null);
  const [churchLoading, setChurchLoading] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const isMobile = useMediaQuery("(max-width: 767px)");
  const debounceTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const [editingPerson, setEditingPerson] = useState<PastorItem | null>(null);
  const [editingChurch, setEditingChurch] = useState<any>(null);

  const [editPastorTitle, setEditPastorTitle] = useState("");
  const [editPastorPhone, setEditPastorPhone] = useState("");
  const [editPastorEmail, setEditPastorEmail] = useState("");
  const [editPastorChucVu, setEditPastorChucVu] = useState("");
  const [editPastorNamSinh, setEditPastorNamSinh] = useState("");
  const [editPastorTenNhiemSo, setEditPastorTenNhiemSo] = useState("");
  const [editPastorNhuDanh, setEditPastorNhuDanh] = useState("");
  const [editPastorDiaChi, setEditPastorDiaChi] = useState("");
  const [editPastorStatus, setEditPastorStatus] = useState("active");

  const [editChurchMemberCount, setEditChurchMemberCount] = useState("");
  const [editChurchRegularAttendance, setEditChurchRegularAttendance] = useState("");
  const [editChurchNewAddress, setEditChurchNewAddress] = useState("");
  const [editChurchOldAddress, setEditChurchOldAddress] = useState("");
  const [editChurchNewWard, setEditChurchNewWard] = useState("");
  const [editChurchFoundedYear, setEditChurchFoundedYear] = useState("");
  const [editChurchNote, setEditChurchNote] = useState("");

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    };
  }, []);

  useEffect(() => {
    if (editingPerson) {
      setEditPastorTitle(editingPerson.title ?? "");
      setEditPastorPhone(editingPerson.phone ?? "");
      setEditPastorEmail(editingPerson.email ?? "");
      setEditPastorChucVu(editingPerson.chucVu ?? "");
      setEditPastorNamSinh(editingPerson.namSinh?.toString() ?? "");
      setEditPastorTenNhiemSo(editingPerson.tenNhiemSo ?? "");
      setEditPastorNhuDanh(editingPerson.nhuDanh ?? "");
      setEditPastorDiaChi(editingPerson.diaChi ?? "");
      setEditPastorStatus(editingPerson.status ?? "active");
    }
  }, [editingPerson]);

  useEffect(() => {
    if (editingChurch) {
      setEditChurchMemberCount(editingChurch.memberCount?.toString() ?? "");
      setEditChurchRegularAttendance(editingChurch.regularAttendanceCount?.toString() ?? "");
      setEditChurchNewAddress(editingChurch.newAddress ?? "");
      setEditChurchOldAddress(editingChurch.oldAddress ?? "");
      setEditChurchNewWard(editingChurch.newWard ?? "");
      setEditChurchFoundedYear(editingChurch.foundedYear?.toString() ?? "");
      setEditChurchNote(editingChurch.note ?? "");
    }
  }, [editingChurch]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearch(val);
    if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    debounceTimeout.current = setTimeout(() => setDebouncedSearch(val), 1000);
  };

  type PastorPage = {
    pastor: PastorItem[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  };

  const {
    data,
    isPending,
    isFetching,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteQuery<PastorPage>({
    queryKey: ["pastor", debouncedSearch],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await api.api["giao-pham"].$get({
        query: { page: String(pageParam), limit: "20", q: debouncedSearch },
      });
      if (!res.ok) throw new Error("Failed to load pastor");
      return (await res.json()) as PastorPage;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage: PastorPage) =>
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

  const pastorList = useMemo(
    () => (data?.pages.flatMap((p: PastorPage) => p.pastor) ?? []),
    [data]
  );

  const totalPastors =
    data?.pages[data.pages.length - 1]?.total ?? pastorList.length;

  const handleChurchClick = async (churchId: number | null) => {
    if (!churchId) return;
    setChurchLoading(true);
    try {
      setSelectedOrganization(null);
      setChurchPastors([]);
      const [churchRes, pastorsRes] = await Promise.all([
        api.api.churches[":id"].$get({
          param: { id: String(churchId) },
        }),
        api.api.churches[":id"]["pastors"].$get({
          param: { id: String(churchId) },
        }),
      ]);
      if (!churchRes.ok) throw new Error("Failed to load church");
      const churchJson = await churchRes.json();
      setSelectedChurch(churchJson.church);
      if (pastorsRes.ok) {
        const pastorsJson = await pastorsRes.json();
        setChurchPastors(pastorsJson.pastors ?? []);
      }
    } finally {
      setChurchLoading(false);
    }
  };

  const handlePastorClick = async (pastorName: string) => {
    setChurchLoading(true);
    try {
      const res = await api.api["giao-pham"][":name"].$get({
        param: { name: encodeURIComponent(pastorName) },
      });
      if (!res.ok) throw new Error("Failed to load pastor");
      const json = await res.json();
      setSelectedPerson({
        ...json.pastor,
        name: json.pastor.name ?? "",
        assignments: (json.pastor.assignments ?? []).map((a: any) => ({
          churchId: a.churchId ?? null,
          organizationId: null,
          churchName: a.churchName,
          form: a.form,
          regionCode: a.regionCode,
          role: a.role,
          memberCount: a.memberCount,
          source: "db" as const,
          isInHcm: false,
        })),
      });
      setSelectedChurch(null);
      setChurchPastors([]);
    } finally {
      setChurchLoading(false);
    }
  };

  const handleOrganizationClick = async (organizationId: number | null) => {
    if (!organizationId) return;
    setChurchLoading(true);
    try {
      setSelectedChurch(null);
      const res = await api.api["giao-pham"]["organizations"][":id"].$get({
        param: { id: String(organizationId) },
      });
      if (!res.ok) throw new Error("Failed to load organization");
      const json = await res.json();
      setSelectedOrganization({
        ...json.organization,
        pastors: json.pastors,
      });
    } finally {
      setChurchLoading(false);
    }
  };

  const handlePastorClickFromOrg = async (pastorName: string) => {
    setChurchLoading(true);
    try {
      const res = await api.api["giao-pham"][":name"].$get({
        param: { name: encodeURIComponent(pastorName) },
      });
      if (!res.ok) throw new Error("Failed to load pastor");
      const json = await res.json();
      setSelectedPerson({
        ...json.pastor,
        name: json.pastor.name ?? "",
        assignments: (json.pastor.assignments ?? []).map((a: any) => ({
          churchId: a.churchId ?? null,
          organizationId: null,
          churchName: a.churchName,
          form: a.form,
          regionCode: a.regionCode,
          role: a.role,
          memberCount: a.memberCount,
          source: "db" as const,
          isInHcm: false,
        })),
      });
      setSelectedOrganization(null);
    } finally {
      setChurchLoading(false);
    }
  };

  const updatePastorMutation = useMutation({
    mutationFn: async ({
      name,
      data,
    }: {
      name: string;
      data: {
        title?: string;
        phone?: string | null;
        email?: string | null;
        chucVu?: string | null;
        namSinh?: number | null;
        tenNhiemSo?: string | null;
        diaChi?: string | null;
        status?: "active" | "inactive";
      };
    }) => {
      const res = await api.api["giao-pham"][":name"].$patch({
        param: { name: encodeURIComponent(name) },
        json: data,
      });
      if (!res.ok) throw new Error("Failed to update pastor");
      return res.json();
    },
    onSuccess: (_data, vars) => {
      setEditingPerson(null);
      queryClient.invalidateQueries({ queryKey: ["pastor"] });
    },
  });

  const updateChurchFromPastorPageMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: number;
      data: {
        memberCount?: number;
        regularAttendanceCount?: number;
        newAddress?: string;
        oldAddress?: string | null;
        newWard?: string;
        foundedYear?: number | null;
        note?: string | null;
      };
    }) => {
      const res = await api.api.churches[":id"].$patch({
        param: { id: String(id) },
        json: data,
      });
      if (!res.ok) throw new Error("Failed to update congregation");
      return res.json();
    },
    onSuccess: (_data, vars) => {
      setEditingChurch(null);
      queryClient.invalidateQueries({ queryKey: ["pastor"] });
      queryClient.invalidateQueries({ queryKey: ["churches"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const handleSavePastor = () => {
    if (!editingPerson) return;
    updatePastorMutation.mutate({
      name: editingPerson.name,
      data: {
        title: editPastorTitle.trim() || undefined,
        phone: editPastorPhone.trim() || null,
        email: editPastorEmail.trim() || null,
        chucVu: editPastorChucVu.trim() || null,
        namSinh: editPastorNamSinh ? Number(editPastorNamSinh) : null,
        tenNhiemSo: editPastorTenNhiemSo.trim() || null,
        diaChi: editPastorDiaChi.trim() || null,
        status: editPastorStatus as "active" | "inactive",
      },
    });
  };

  const handleSaveChurchFromPastorPage = () => {
    if (!editingChurch) return;
    updateChurchFromPastorPageMutation.mutate({
      id: editingChurch.id,
      data: {
        memberCount: editChurchMemberCount ? Number(editChurchMemberCount) : undefined,
        regularAttendanceCount: editChurchRegularAttendance
          ? Number(editChurchRegularAttendance)
          : undefined,
        newAddress: editChurchNewAddress.trim() || undefined,
        oldAddress: editChurchOldAddress.trim() || null,
        newWard: editChurchNewWard.trim() || undefined,
        foundedYear: editChurchFoundedYear ? Number(editChurchFoundedYear) : null,
        note: editChurchNote.trim() || null,
      },
    });
  };

  return (
    <>
      <div className="space-y-5">
      <div
        className="will-change-transform"
        style={{
          transform: `translateY(${Math.max(-scrollY, -150)}px)`,
          opacity: Math.max(1 - scrollY / 90, 0),
          transition: "none",
        }}
      >
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Danh Bộ Giáo Phẩm ({totalPastors})
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Mục sư Quản nhiệm, Kiêm nhiệm & Truyền đạo Đặc trách tại KV TP.HCM
        </p>
      </div>

      <div
        className={`sticky z-20 ${isMobile ? "top-14" : "top-4"} pb-2 rounded-2xl`}
      >
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={handleSearchChange}
            placeholder="Tìm tên Mục sư, Truyền đạo, số điện thoại hoặc Hội Thánh..."
            className="w-full rounded-3xl border border-slate-200 bg-white pl-10 pr-4 py-3 text-sm outline-none focus:border-indigo-600 min-h-12"
          />
        </div>
      </div>

      {(isPending || isFetching) && pastorList.length === 0 ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-24 rounded-2xl bg-white border border-slate-200/70 animate-pulse"
            />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {pastorList.map((person) => (
            <div
              key={person.name}
              onClick={() => setSelectedPerson(person)}
              className="rounded-2xl border border-slate-200/80 bg-white p-4 space-y-3 hover:border-indigo-300 transition-colors cursor-pointer"
            >
              <div className="space-y-1">
                <h2 className="mt-1.5 text-base font-bold text-slate-900">
                  {displayPastorName(person.title, person.name)}
                </h2>
                {person.phone && (
                  <a
                    href={`tel:${person.phone}`}
                    className="inline-flex items-center gap-1 font-mono text-xs text-slate-600 hover:underline cursor-pointer mb-6"
                  >
                    <Phone className="h-3 w-3 text-slate-500 shrink-0" />
                    <span>{person.phone}</span>
                  </a>
                )}

                {person.assignments.length > 0 ? (
                  <div className="space-y-1">
                    {person.assignments.map((a, i) => {
                      const isOrg =
                        a.organizationId !== null && a.churchId === null;
                      return (
                        <div
                          key={`assign-${i}`}
                          onClick={
                            a.isOtherWork
                              ? undefined
                              : isOrg
                                ? (e) => {
                                    e.stopPropagation();
                                    handleOrganizationClick(a.organizationId);
                                  }
                                : (e) => {
                                    e.stopPropagation();
                                    handleChurchClick(a.churchId);
                                  }
                          }
                          className="flex items-center justify-between gap-2 text-xs rounded-lg  px-3 py-2 hover:bg-slate-50 cursor-pointer"
                        >
                          <span className="inline-flex items-center gap-1.5 font-medium text-slate-800">
                            {a.isOtherWork ? (
                              <span className="h-3.5 w-3.5 text-slate-400 shrink-0">
                                {a.churchName}
                              </span>
                            ) : (
                              <>
                                {isOrg ? (
                                  <Building2 className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                                ) : (
                                  <Church className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                                )}
                                <span>
                                  {a.churchId !== null
                                    ? displayChurchName(a.form, a.churchName)
                                    : a.churchName}
                                  {a.source === "db" && !isOrg
                                    ? ` (KV ${a.regionCode})`
                                    : ""}
                                </span>
                              </>
                            )}
                          </span>
                          {!a.isOtherWork && (
                            <span className="shrink-0 rounded bg-white border border-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                              {a.role}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            </div>
          )          )}
          {isFetching && pastorList.length > 0 && (
            <div className="text-center py-4 text-xs text-slate-500">
              Đang tải thêm…
            </div>
          )}
          <div ref={loadMoreRef} className="h-[1px]" />
        </div>
      )}

      {/* Pastor Detail Sheet */}
      <ResponsiveSheet
        open={Boolean(selectedPerson)}
        onOpenChange={(open) => !open && setSelectedPerson(null)}
        title={
          selectedPerson
            ? displayPastorName(selectedPerson.title, selectedPerson.name)
            : ""
        }
      >
        {selectedPerson && (
          <div className="space-y-5 text-sm">
            <div className="flex items-center justify-between gap-3 mb-2">
              <span className="text-[10px] font-semibold uppercase text-slate-400 tracking-wider">
                Chi tiết Giáo Phẩm
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={!isAuthenticated() || !selectedPerson}
                onClick={() => {
                  if (!isAuthenticated()) return;
                  setEditingPerson(selectedPerson);
                }}
              >
                {editingPerson?.name === selectedPerson?.name
                  ? "Đang chỉnh sửa..."
                  : "Sửa thông tin"}
              </Button>
            </div>
            {(() => {
              const hasAnyData = Boolean(
                selectedPerson.phone ||
                selectedPerson.email ||
                selectedPerson.chucVu ||
                selectedPerson.namSinh ||
                selectedPerson.tenNhiemSo ||
                selectedPerson.nhuDanh ||
                selectedPerson.diaChi ||
                selectedPerson.assignments.length > 0,
              );
              if (!hasAnyData) return null;
              return (
                <>
                  <div className="flex items-end gap-3">
                    {selectedPerson.phone && (
                      <a
                        href={`tel:${selectedPerson.phone}`}
                        className="inline-flex items-center gap-1 font-mono text-xs text-slate-600 hover:underline cursor-pointer"
                      >
                        <Phone className="h-3 w-3 text-slate-500 shrink-0" />
                        <span>{selectedPerson.phone}</span>
                      </a>
                    )}
                    {selectedPerson.email && (
                      <a
                        href={`mailto:${selectedPerson.email}`}
                        className="inline-flex items-center gap-1 font-mono text-xs text-slate-600 hover:underline cursor-pointer"
                      >
                        <Mail className="h-3 w-3 text-slate-500 shrink-0" />
                        <span>{selectedPerson.email}</span>
                      </a>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(() => {
                      const allRoles = new Set<string>();
                      if (selectedPerson.chucVu) {
                        allRoles.add(selectedPerson.chucVu);
                      }
                      selectedPerson.assignments.forEach((a) => {
                        if (a.role) allRoles.add(a.role);
                      });
                      const rolesArray = Array.from(allRoles);

                      const infoItems = [
                        rolesArray.length > 0 ? rolesArray.join(", ") : null,
                        selectedPerson.namSinh,
                        selectedPerson.tenNhiemSo,
                        selectedPerson.nhuDanh,
                        selectedPerson.diaChi,
                      ].filter(Boolean);
                      const isSingle = infoItems.length === 1;
                      return (
                        <>
                          {rolesArray.length > 0 && (
                            <div
                              className={`rounded-xl border border-slate-200/80 p-4 bg-white ${isSingle ? "md:col-span-2" : ""}`}
                            >
                              <p className="text-[11px] font-semibold uppercase text-slate-400 mb-2">
                                Chức vụ
                              </p>
                              <p className="text-sm text-slate-900">
                                {rolesArray.join(", ")}
                              </p>
                            </div>
                          )}
                          {selectedPerson.namSinh && (
                            <div
                              className={`rounded-xl border border-slate-200/80 p-4 bg-white ${isSingle ? "md:col-span-2" : ""}`}
                            >
                              <p className="text-[11px] font-semibold uppercase text-slate-400 mb-2">
                                Năm sinh
                              </p>
                              <p className="text-sm text-slate-900">
                                {selectedPerson.namSinh}
                              </p>
                            </div>
                          )}
                          {selectedPerson.tenNhiemSo && (
                            <div
                              className={`rounded-xl border border-slate-200/80 p-4 bg-white ${isSingle ? "md:col-span-2" : ""}`}
                            >
                              <p className="text-[11px] font-semibold uppercase text-slate-400 mb-2">
                                Tên nhiệm sở
                              </p>
                              <p className="text-sm text-slate-900">
                                {selectedPerson.tenNhiemSo}
                              </p>
                            </div>
                          )}
                          {selectedPerson.nhuDanh && (
                            <div
                              className={`rounded-xl border border-slate-200/80 p-4 bg-white ${isSingle ? "md:col-span-2" : ""}`}
                            >
                              <p className="text-[11px] font-semibold uppercase text-slate-400 mb-2">
                                Nhủ danh
                              </p>
                              <p className="text-sm text-slate-900">
                                {selectedPerson.nhuDanh}
                              </p>
                            </div>
                          )}
                          {selectedPerson.diaChi && (
                            <div
                              className={`rounded-xl border border-slate-200/80 p-4 bg-white ${isSingle ? "md:col-span-2" : ""}`}
                            >
                              <p className="text-[11px] font-semibold uppercase text-slate-400 mb-2">
                                Địa chỉ
                              </p>
                              <p className="text-sm text-slate-900">
                                {selectedPerson.diaChi}
                              </p>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>

                  {selectedPerson.assignments.length > 0 && (
                    <>
                      <h2 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                        <Church className="h-3.5 w-3.5 text-indigo-600" />
                        Công tác / Chức vụ ({selectedPerson.assignments.length})
                      </h2>
                      <div className="space-y-2">
                        {selectedPerson.assignments.map((a) => {
                          const isOrg =
                            a.organizationId !== null && a.churchId === null;
                          return (
                            <div
                              key={`${a.organizationId || a.churchId}-${a.role}`}
                              onClick={
                                a.isOtherWork || isOrg
                                  ? undefined
                                  : () => handleChurchClick(a.churchId)
                              }
                              className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 hover:bg-slate-50 transition-colors cursor-pointer"
                            >
                              <div className="flex items-center gap-2">
                                {!a.isOtherWork && !isOrg && (
                                  <Church className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                                )}
                                {isOrg && (
                                  <Building2 className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                                )}
                                <div className="text-sm font-medium text-slate-900">
                                  {a.isOtherWork
                                    ? a.churchName
                                    : a.churchId !== null
                                      ? displayChurchName(a.form, a.churchName)
                                      : a.churchName}
                                </div>
                              </div>
                              <div className="text-right">
                                <span className="shrink-0 rounded bg-white border border-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                                  {a.role}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </>
              );
            })()}
          </div>
        )}
      </ResponsiveSheet>

      {/* Church Detail Sheet */}
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
        {churchLoading ? (
          <div className="h-64 rounded-2xl bg-white border border-slate-200/70 animate-pulse" />
        ) : (
          selectedChurch && (
            <div className="space-y-4 text-xs">
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
                      <Users className="h-3.5 w-3.5 text-indigo-600" />
                      <span className="font-bold text-slate-900">
                        {selectedChurch.memberCount.toLocaleString("vi-VN")}
                      </span>
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200/80 p-3.5">
                    <p className="text-[11px] font-semibold uppercase text-slate-400">
                      Tín hữu trung tín
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5 text-indigo-600" />
                      <span className="font-bold text-slate-900">
                        {selectedChurch.regularAttendanceCount.toLocaleString(
                          "vi-VN",
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {churchPastors.length > 0 && (
                <div className="rounded-xl border border-slate-200/80 p-3.5 space-y-2">
                  <p className="text-[11px] font-semibold uppercase text-slate-400">
                    Nhân sự
                  </p>
                  <div className="space-y-2">
                    {churchPastors.map((p) => (
                      <div
                        key={p.id || p.name}
                        className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 hover:bg-slate-50 transition-colors cursor-pointer"
                        onClick={() => handlePastorClick(p.name)}
                      >
                        <div className="flex items-center gap-2">
                          <User className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                          <div>
                            <div className="text-sm font-medium text-slate-900">
                              {p.name}
                            </div>
                            {p.title ? (
                              <div className="text-[11px] text-slate-500">
                                {p.title}
                              </div>
                            ) : null}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="shrink-0 rounded bg-white border border-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                            {p.role}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedChurch.pastorName && (
                <div className="rounded-xl border border-slate-200/80 p-3.5 space-y-2">
                  <p className="text-[11px] font-semibold uppercase text-slate-400">
                    {selectedChurch.pastorRole || "Quản nhiệm"}
                  </p>
                  <div className="flex items-center gap-2">
                    <User className="h-3.5 w-3.5 text-indigo-600" />
                    <span className="text-sm font-medium text-slate-900">
                      {displayPastorName(
                        selectedChurch.pastorTitle,
                        selectedChurch.pastorName,
                      )}
                      {selectedChurch.pastorRole && (
                        <span className="ml-1 text-[11px] font-medium text-slate-400">
                          ({selectedChurch.pastorRole})
                        </span>
                      )}
                    </span>
                  </div>
                  {selectedChurch.pastorPhone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-3 w-3 text-indigo-600" />
                      <a
                        href={`tel:${selectedChurch.pastorPhone}`}
                        className="text-sm text-indigo-600 hover:underline cursor-pointer"
                      >
                        {selectedChurch.pastorPhone}
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        )}
      </ResponsiveSheet>

      {/* Organization Detail Sheet */}
      <ResponsiveSheet
        open={Boolean(selectedOrganization)}
        onOpenChange={(open) => !open && setSelectedOrganization(null)}
        title={selectedOrganization ? selectedOrganization.name : ""}
      >
        {churchLoading ? (
          <div className="h-64 rounded-2xl bg-white border border-slate-200/70 animate-pulse" />
        ) : selectedOrganization && selectedOrganization.pastors ? (
          <div className="space-y-4 text-xs">
            <div className="rounded-xl border border-slate-200/80 p-3.5 space-y-2">
              <p className="text-[11px] font-semibold uppercase text-slate-400">
                Nhân sự
              </p>
              <div className="space-y-2">
                {selectedOrganization.pastors.map((p: any) => (
                  <div
                    key={p.id || p.name}
                    onClick={() => handlePastorClickFromOrg(p.name)}
                    className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 hover:bg-slate-50 transition-colors cursor-pointer"
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
                ))}
                {selectedOrganization.pastors.length === 0 && (
                  <div className="text-sm text-slate-500 text-center py-4">
                    Chưa có mục sư nào được phân công
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </ResponsiveSheet>
    </div>

    {/* Pastor Edit Form */}
    {editingPerson && (
      <div className="max-w-lg mx-auto mt-8">
        <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-900">
              Chỉnh sửa Giáo Phẩm
            </h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditingPerson(null)}
            >
              <X className="h-4 w-4" /> Hủy
            </Button>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSavePastor();
            }}
            className="space-y-3"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-1">
                  Chức danh
                </label>
                <input
                  type="text"
                  value={editPastorTitle}
                  onChange={(e) => setEditPastorTitle(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-600"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-1">
                  Số điện thoại
                </label>
                <input
                  type="tel"
                  value={editPastorPhone}
                  onChange={(e) => setEditPastorPhone(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-600"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={editPastorEmail}
                  onChange={(e) => setEditPastorEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-600"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-1">
                  Chức vụ
                </label>
                <input
                  type="text"
                  value={editPastorChucVu}
                  onChange={(e) => setEditPastorChucVu(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-600"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-1">
                  Năm sinh
                </label>
                <input
                  type="number"
                  value={editPastorNamSinh}
                  onChange={(e) => setEditPastorNamSinh(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-600"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-1">
                  Tên nhiệm sở
                </label>
                <input
                  type="text"
                  value={editPastorTenNhiemSo}
                  onChange={(e) => setEditPastorTenNhiemSo(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-600"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-1">
                  Nhủ danh
                </label>
                <input
                  type="text"
                  value={editPastorNhuDanh}
                  onChange={(e) => setEditPastorNhuDanh(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-600"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-1">
                  Địa chỉ
                </label>
                <input
                  type="text"
                  value={editPastorDiaChi}
                  onChange={(e) => setEditPastorDiaChi(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-600"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-1">
                  Trạng thái
                </label>
                <select
                  value={editPastorStatus}
                  onChange={(e) => setEditPastorStatus(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-600"
                >
                  <option value="active">Hoạt động</option>
                  <option value="inactive">Ngưng hoạt động</option>
                </select>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <Button
                variant="outline"
                type="button"
                onClick={() => setEditingPerson(null)}
              >
                Hủy
              </Button>
              <Button
                variant="primary"
                type="submit"
                disabled={updatePastorMutation.isPending}
              >
                {updatePastorMutation.isPending
                  ? "Đang lưu..."
                  : "Lưu thay đổi"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    )}

    {/* Church Edit Form */}
    {editingChurch && (
      <div className="max-w-lg mx-auto mt-8">
        <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-900">
              Chỉnh sửa Hội Thánh
            </h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditingChurch(null)}
            >
              <X className="h-4 w-4" /> Hủy
            </Button>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSaveChurchFromPastorPage();
            }}
            className="space-y-3"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-1">
                  Số tín hữu
                </label>
                <input
                  type="number"
                  value={editChurchMemberCount}
                  onChange={(e) => setEditChurchMemberCount(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-600"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-1">
                  Tín hữu trung tín
                </label>
                <input
                  type="number"
                  value={editChurchRegularAttendance}
                  onChange={(e) => setEditChurchRegularAttendance(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-600"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-1">
                  Địa chỉ mới (2026)
                </label>
                <input
                  type="text"
                  value={editChurchNewAddress}
                  onChange={(e) => setEditChurchNewAddress(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-600"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-1">
                  Phường / Xã
                </label>
                <input
                  type="text"
                  value={editChurchNewWard}
                  onChange={(e) => setEditChurchNewWard(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-600"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-1">
                  Địa chỉ cũ
                </label>
                <input
                  type="text"
                  value={editChurchOldAddress}
                  onChange={(e) => setEditChurchOldAddress(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-600"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-1">
                  Năm thành lập
                </label>
                <input
                  type="number"
                  value={editChurchFoundedYear}
                  onChange={(e) => setEditChurchFoundedYear(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-600"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-1">
                  Ghi chú
                </label>
                <textarea
                  value={editChurchNote}
                  onChange={(e) => setEditChurchNote(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-600 min-h-[80px]"
                />
              </div>
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <Button
                variant="outline"
                type="button"
                onClick={() => setEditingChurch(null)}
              >
                Hủy
              </Button>
              <Button
                variant="primary"
                type="submit"
                disabled={updateChurchFromPastorPageMutation.isPending}
              >
                {updateChurchFromPastorPageMutation.isPending
                  ? "Đang lưu..."
                  : "Lưu thay đổi"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    )}
    </>
  );
}
