import { RequestForm } from "@/app/requests/request-form";

export const metadata = { title: "Request a flavour · Dawg Treats" };

export default function RequestsPage() {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-6 py-12">
      <h1 className="text-4xl font-semibold">What should I bake?</h1>
      <p className="mt-3 text-secondary">
        Tell me what you&apos;d like to see on the menu. I read every one of these when planning the
        week.
      </p>
      <RequestForm className="mt-8" />
    </main>
  );
}
