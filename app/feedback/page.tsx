import { Card } from "@/components/ui/card";
import { FeedbackForm } from "@/components/feedback-form";

export const metadata = { title: "Feedback · Dawg Treats" };

export default function FeedbackPage() {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-6 py-12">
      <h1 className="text-4xl font-semibold">Tell me what you think</h1>
      <p className="mt-3 text-secondary">
        How the cookies were, what you&apos;d like baked next, or anything else. No account
        needed.
      </p>
      <Card className="mt-8">
        <FeedbackForm />
      </Card>
    </main>
  );
}
