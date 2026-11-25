import React, { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { setToken, setUser, removeToken } from "@/lib/auth";
import { LogIn, LogOut, ShieldCheck, ArrowLeft } from "lucide-react";

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.api.auth.login.$post({
        json: { email, password },
      });
      if (!res.ok) {
        const err = (await res.json()) as { error: string };
        setError(err.error || "Invalid email or password");
        setLoading(false);
        return;
      }
      const data = await res.json();
      setToken(data.token);
      setUser(data.user);
      navigate({ to: "/" });
    } catch {
      setError("Unable to connect to the server.");
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await api.api.auth.logout.$post();
    } catch {
      // ignore
    }
    removeToken();
    navigate({ to: "/login" });
  };

  const user = JSON.parse(localStorage.getItem("htkv_admin_user") || "null");

  if (user) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-slate-50 text-slate-900 px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <div className="flex items-center gap-3 mb-6">
            <ShieldCheck className="h-6 w-6 text-indigo-600" />
            <h1 className="text-xl font-bold tracking-tight">Đã đăng nhập</h1>
          </div>
          <p className="text-slate-600 mb-6">
            Bạn đang đăng nhập với tư vị quản trị viên:{" "}
            <span className="font-medium">{user.email}</span>
          </p>
          <div className="space-y-3">
            <Button
              onClick={handleLogout}
              variant="destructive"
              className="w-full"
            >
              <LogOut className="h-4 w-4 mr-2" /> Đăng xuất
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link to="/">
                <ArrowLeft className="h-4 w-4 mr-2" /> Trở về trang chủ
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-slate-50 text-slate-900 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <div className="flex items-center gap-3 mb-6">
          <ShieldCheck className="h-6 w-6 text-indigo-600" />
          <h1 className="text-xl font-bold tracking-tight">
            Đăng nhập Quản Trị
          </h1>
        </div>
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-700 text-sm border border-red-100">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              placeholder="admin@htkv.vn"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">
              Mật khẩu
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              placeholder="••••••••"
            />
          </div>
          <Button
            type="submit"
            variant="primary"
            className="w-full"
            disabled={loading}
          >
            {loading ? "Đang đăng nhập..." : "Đăng nhập"}
          </Button>
        </form>
      </div>
    </div>
  );
}
