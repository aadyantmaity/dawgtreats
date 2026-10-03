import { Card } from "@/components/ui/card";
import { FeedbackForm } from "@/components/feedback-form";

export const metadata = { title: "Feedback" };

export default function FeedbackPage() {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-6 py-12">
      <h1 className="text-4xl font-semibold">Tell me what you think</h1>
      <p className="mt-3 text-secondary">
        How the cookies were, or what to bake next.
      </p>
      <Card className="mt-8">
        <FeedbackForm />
      </Card>
    </main>
  );
}
