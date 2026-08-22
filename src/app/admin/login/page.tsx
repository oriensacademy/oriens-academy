import { redirect } from "next/navigation";

export default function LegacyAdminLoginPage() {
  redirect("/tr/giris?next=%2Fadmin");
}
