import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const metadata = { title: "Jobs" };

// Where applications go. An interest form rather than a mailbox, so the four questions
// below are answered in one sitting instead of over a thread.
const FORM_URL = "https://forms.gle/REPLACE_ME";

type Role = {
  title: string;
  doing: string[];
  wanting: string[];
  bonus: string[];
};

const ROLES: Role[] = [
  {
    title: "Product & Operations",
    doing: [
      "Own a problem end to end, from the question to the recommendation.",
      "Interview customers and people who haven't bought, and turn it into something we can act on.",
      "Define the metrics we track, then report on them every week.",
      "Bring what you learn to roadmap planning and make the case for what's next.",
    ],
    wanting: [
      "You start conversations with strangers without being pushed.",
      "You're good with data: analysis, forecasting, and spotting the trend behind the number.",
      "You write clearly and briefly.",
    ],
    bonus: ["You've managed a product, club or project before."],
  },
  {
    title: "Software Engineering",
    doing: [
      "Own features end to end across the stack, back-end and front-end: schema, API, interface, tests.",
      "Ship to production consistently.",
      "Propose your own improvements to the codebase.",
    ],
    wanting: [
      "TypeScript or JavaScript, written outside of coursework.",
      "React, or another component framework.",
      "git: branches, commits, pull requests.",
      "SQL: reading and writing basic queries.",
      "You've built and deployed something to solve a real problem, and it had users.",
    ],
    bonus: [
      "Next.js (App Router), Postgres, Tailwind, Stripe, Vercel.",
      "Automated testing with Vitest, Playwright, or similar.",
    ],
  },
];

const QUESTIONS = [
  "Which role, or both?",
  "Link to something you made and finished.",
  "You have one week. What would you change about Dawg Treats first?",
  "Hours a week, and are you around on pickup days?",
];

// Three of these per role, same shape each time, so the two cards can be read side by side.
function Section({ heading, items }: { heading: string; items: string[] }) {
  return (
    <div className="mt-6 first:mt-0">
      <h3 className="font-sans text-sm font-semibold text-secondary">{heading}</h3>
      <ul className="mt-2 flex flex-col gap-2">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span aria-hidden className="text-tertiary">
              &bull;
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function JobsPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 animate-fade py-12">
      <h1 className="text-4xl font-semibold">Work on Dawg Treats</h1>
      <p className="mt-3 text-secondary">
        Two roles, about 10 hours a week, on campus. Freshmen welcome.
      </p>

      <div className="mt-8 flex flex-col gap-6">
        {ROLES.map((role) => (
          <Card key={role.title}>
            <h2 className="text-2xl font-semibold">{role.title}</h2>
            <div className="mt-5">
              <Section heading="What you'll do" items={role.doing} />
              <Section heading="What we're looking for" items={role.wanting} />
              <Section heading="Nice to have" items={role.bonus} />
            </div>
          </Card>
        ))}
      </div>

      <section className="mt-10">
        <h2 className="text-2xl font-semibold">Applying</h2>
        <p className="mt-2 text-secondary">
          No resume, no cover letter. Four questions, and we read every answer.
        </p>
        <ol className="mt-4 flex list-inside list-decimal flex-col gap-2">
          {QUESTIONS.map((question) => (
            <li key={question}>{question}</li>
          ))}
        </ol>
        <a href={FORM_URL} className={buttonClass({ size: "md", className: "mt-6" })}>
          Open the form
        </a>
      </section>
    </main>
  );
}
