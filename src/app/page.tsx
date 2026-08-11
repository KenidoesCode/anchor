import { redirect } from "next/navigation";

export default function Home() {
  // Slice 1 has a single screen: the assignment gate.
  redirect("/assign");
}
