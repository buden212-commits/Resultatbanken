import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Admin — Resultatbanken",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  redirect("/ladda-upp");
}
