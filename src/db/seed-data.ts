export type SeedQuestion = {
  prompt: string;
  type: "single" | "multiple" | "true_false";
  /** Index of the lesson (within the same module) that teaches this. */
  lesson: number;
  explanation: string;
  options: { text: string; correct: boolean }[];
};

export type SeedLesson = {
  title: string;
  type?: "reading" | "video";
  minutes: number;
  videoUrl?: string;
  content: string;
};

export type SeedModule = {
  title: string;
  lessons: SeedLesson[];
  quiz: { title: string; questions: SeedQuestion[] };
};

export type SeedCourse = {
  slug: string;
  title: string;
  summary: string;
  description: string;
  category: string;
  level: "beginner" | "intermediate" | "advanced";
  coverTheme: "violet" | "sky" | "amber" | "emerald" | "rose";
  status: "draft" | "published";
  instructor: "maya" | "jonas";
  modules: SeedModule[];
};

/** Deterministically place the correct option(s) so answers aren't always "A". */
function arrange(
  prompt: string,
  correct: string[],
  wrong: string[],
): { text: string; correct: boolean }[] {
  const all = [...wrong];
  correct.forEach((c, i) => {
    const at = (prompt.length + i * 2) % (all.length + 1);
    all.splice(at, 0, c);
  });
  return all.map((text) => ({ text, correct: correct.includes(text) }));
}

const single = (
  prompt: string,
  lesson: number,
  correct: string,
  wrong: string[],
  explanation: string,
): SeedQuestion => ({
  prompt,
  type: "single",
  lesson,
  explanation,
  options: arrange(prompt, [correct], wrong),
});

const multi = (
  prompt: string,
  lesson: number,
  correct: string[],
  wrong: string[],
  explanation: string,
): SeedQuestion => ({
  prompt,
  type: "multiple",
  lesson,
  explanation,
  options: arrange(prompt, correct, wrong),
});

const trueFalse = (
  prompt: string,
  lesson: number,
  answer: boolean,
  explanation: string,
): SeedQuestion => ({
  prompt,
  type: "true_false",
  lesson,
  explanation,
  options: [
    { text: "True", correct: answer },
    { text: "False", correct: !answer },
  ],
});

export const seedCourses: SeedCourse[] = [
  {
    slug: "project-management-essentials",
    title: "Project Management Essentials",
    summary: "Plan, scope and deliver projects with confidence — from kickoff to hand-over.",
    description:
      "A practical introduction to running projects at work. You will learn how to define scope, work with stakeholders, break work into manageable pieces, estimate honestly, and keep risks visible.",
    category: "Management",
    level: "beginner",
    coverTheme: "violet",
    status: "published",
    instructor: "maya",
    modules: [
      {
        title: "Foundations",
        lessons: [
          {
            title: "What is a project?",
            minutes: 6,
            content: `A **project** is a temporary effort that creates a unique result. It has a start, an end, and a defined outcome — which is what separates it from ongoing operations such as running a help desk.\n\n## The triple constraint\nEvery project balances three levers:\n\n- **Scope** — what you will deliver\n- **Time** — when you will deliver it\n- **Cost** — the money and effort available\n\nChanging one lever almost always pressures the other two. Good project managers make that trade-off visible instead of absorbing it silently.`,
          },
          {
            title: "Defining scope",
            minutes: 8,
            content: `Scope is the agreed boundary of the work. A clear **scope statement** lists the deliverables, what is explicitly *out* of scope, and how you will know the work is done.\n\n## Avoiding scope creep\nScope creep is uncontrolled growth in what the project is asked to deliver. Guard against it by:\n\n1. Writing acceptance criteria for every deliverable\n2. Logging every new request as a **change request**\n3. Assessing the impact on time and cost before saying yes\n\nSaying "yes, and here is what it will cost" is very different from saying "yes".`,
          },
          {
            title: "Stakeholders and roles",
            minutes: 7,
            content: `A **stakeholder** is anyone affected by, or able to affect, your project. Sponsors fund it, users live with the result, and teams build it.\n\n## Mapping stakeholders\nPlot people by *influence* and *interest*:\n\n- High influence, high interest → **manage closely**\n- High influence, low interest → **keep satisfied**\n- Low influence, high interest → **keep informed**\n- Low influence, low interest → **monitor**\n\nThe project **sponsor** owns the business case; the **project manager** owns delivery.`,
          },
        ],
        quiz: {
          title: "Foundations quiz",
          questions: [
            single(
              "Which of these best describes a project?",
              0,
              "A temporary effort that creates a unique result",
              ["Ongoing work that repeats every month", "Any task that takes more than a day", "A team's regular responsibilities"],
              "Projects are temporary and produce something unique; operations are ongoing and repeatable.",
            ),
            multi(
              "Which are the three levers of the triple constraint?",
              0,
              ["Scope", "Time", "Cost"],
              ["Morale", "Brand"],
              "Scope, time and cost are the classic triple constraint.",
            ),
            single(
              "A new feature request arrives mid-project. What is the best first step?",
              1,
              "Log it as a change request and assess the impact",
              ["Add it quietly to keep the client happy", "Reject it automatically", "Ask the team to absorb it"],
              "Changes are assessed for impact on time and cost before they are accepted.",
            ),
            single(
              "A stakeholder has high influence but low interest. How should you treat them?",
              2,
              "Keep them satisfied",
              ["Ignore them", "Manage them closely every day", "Only keep them informed"],
              "High influence / low interest stakeholders should be kept satisfied without over-communicating.",
            ),
          ],
        },
      },
      {
        title: "Planning & Delivery",
        lessons: [
          {
            title: "Breaking work down with a WBS",
            minutes: 8,
            content: `A **work breakdown structure (WBS)** splits the project into smaller and smaller deliverables until each piece can be estimated and owned by one person.\n\n## Rules of thumb\n- Decompose by *deliverable*, not by activity\n- Stop when a work package is roughly 8–80 hours\n- Every item must roll up to a parent — nothing orphaned\n\nThe WBS is the foundation for estimates, schedules and risk reviews.`,
          },
          {
            title: "Estimating and scheduling",
            minutes: 9,
            content: `Estimates are predictions, not promises. Improve them by estimating bottom-up from work packages and asking the people who will do the work.\n\n## Techniques\n- **Three-point estimates:** (optimistic + 4 × likely + pessimistic) ÷ 6\n- **Critical path:** the longest chain of dependent tasks; any delay on it delays the project\n- **Buffers:** add contingency deliberately and name it\n\nShare ranges ("3–5 weeks") rather than false precision.`,
          },
          {
            title: "Tracking risks",
            minutes: 7,
            content: `A **risk** is an uncertain event that could help or harm the project. Keep a **risk register** with a description, likelihood, impact, owner and response.\n\n## Responses\n- **Avoid** — change the plan so the risk cannot occur\n- **Mitigate** — reduce likelihood or impact\n- **Transfer** — insurance or contracts\n- **Accept** — monitor and prepare a fallback\n\nReview the register in every status meeting; risks are only useful when they stay current.`,
          },
        ],
        quiz: {
          title: "Planning & Delivery quiz",
          questions: [
            single(
              "What should a WBS be decomposed by?",
              0,
              "Deliverables",
              ["Individual people", "Calendar months", "Meeting agendas"],
              "A WBS is deliverable-oriented; activities and schedules come later.",
            ),
            trueFalse(
              "The critical path is the shortest chain of tasks in the schedule.",
              1,
              false,
              "The critical path is the LONGEST chain of dependent tasks; delays on it delay the whole project.",
            ),
            single(
              "Using a three-point estimate with optimistic 2, likely 4 and pessimistic 12 days, the expected duration is…",
              1,
              "5 days",
              ["4 days", "6 days", "7 days"],
              "(2 + 4×4 + 12) ÷ 6 = 5 days.",
            ),
            single(
              "Buying insurance against a supplier failing is which risk response?",
              2,
              "Transfer",
              ["Avoid", "Mitigate", "Accept"],
              "Insurance transfers the financial impact of the risk to a third party.",
            ),
          ],
        },
      },
    ],
  },
  {
    slug: "data-literacy-for-managers",
    title: "Data Literacy for Managers",
    summary: "Read charts critically, ask sharper questions and present findings people trust.",
    description:
      "You do not need to code to be data-literate. This course teaches managers how to interpret the numbers in front of them, spot misleading visuals, and turn data into decisions.",
    category: "Analytics",
    level: "beginner",
    coverTheme: "sky",
    status: "published",
    instructor: "jonas",
    modules: [
      {
        title: "Reading the Numbers",
        lessons: [
          {
            title: "Types of data",
            minutes: 5,
            content: `Data comes in two broad families. **Categorical** data puts things into groups (department, region). **Numerical** data measures amounts (revenue, hours).\n\nKnowing which you have decides which summaries and charts make sense — you can average revenue, but not "region".`,
          },
          {
            title: "Averages and spread",
            minutes: 8,
            content: `The **mean** is sensitive to outliers; the **median** is the middle value and is more robust. Always ask for the spread too — the range or standard deviation.\n\n## Example\nSalaries of 30k, 32k, 35k and 400k have a mean near 124k, but a median of 33.5k. Which describes a typical employee?`,
          },
          {
            title: "Charts that mislead",
            minutes: 7,
            content: `Watch for:\n\n- **Truncated axes** that exaggerate small differences\n- **Cherry-picked time windows**\n- **Dual axes** that imply a relationship\n- **3-D effects** that distort proportions\n\nWhen in doubt, ask: *what would this look like starting from zero, over a longer period?*`,
          },
        ],
        quiz: {
          title: "Reading the Numbers quiz",
          questions: [
            single(
              "Which of these is categorical data?",
              0,
              "Sales region",
              ["Monthly revenue", "Hours worked", "Customer age in years"],
              "Region groups records into labelled categories; the others are measurements.",
            ),
            single(
              "Salaries are 30k, 32k, 35k and 400k. Which statistic best describes a typical salary?",
              1,
              "The median",
              ["The mean", "The maximum", "The sum"],
              "The outlier drags the mean upward; the median is robust.",
            ),
            multi(
              "Which are common ways charts mislead?",
              2,
              ["Truncated axes", "Cherry-picked time windows"],
              ["Labelling the axes", "Including a source note"],
              "Truncated axes and selective windows exaggerate or hide trends.",
            ),
            trueFalse(
              "The mean is always the best measure of a typical value.",
              1,
              false,
              "With outliers or skewed data the median is often more representative.",
            ),
          ],
        },
      },
      {
        title: "Asking Better Questions",
        lessons: [
          {
            title: "Correlation vs. causation",
            minutes: 7,
            content: `Two things moving together (**correlation**) does not mean one causes the other. Ice-cream sales and sunburn both rise in summer — heat drives both.\n\nTo argue for causation you need a plausible mechanism, a consistent timing (cause before effect), and ideally an experiment.`,
          },
          {
            title: "Designing a useful metric",
            minutes: 8,
            content: `A good metric is **actionable**, **comparable** and **hard to game**. Prefer rates and ratios over raw counts, and pair a volume metric with a quality metric so teams cannot optimise one at the other's expense.`,
          },
          {
            title: "Presenting findings",
            minutes: 6,
            content: `Lead with the answer, then the evidence. One chart should make one point, with a title that states it. Always say what you recommend and how confident you are.`,
          },
        ],
        quiz: {
          title: "Asking Better Questions quiz",
          questions: [
            single(
              "Ice-cream sales and sunburn cases rise together. The best explanation is…",
              0,
              "A third factor (hot weather) drives both",
              ["Ice cream causes sunburn", "Sunburn makes people buy ice cream", "It is pure coincidence"],
              "A confounding variable can create correlation without causation.",
            ),
            multi(
              "Which are properties of a good metric?",
              1,
              ["Actionable", "Hard to game"],
              ["Impossible to measure", "Changes meaning every quarter"],
              "Good metrics drive action and resist manipulation.",
            ),
            single(
              "When presenting findings, what should come first?",
              2,
              "The answer or recommendation",
              ["The raw data tables", "The methodology appendix", "A list of every chart you made"],
              "Lead with the answer so the audience knows why the evidence matters.",
            ),
            trueFalse(
              "Pairing a volume metric with a quality metric helps prevent gaming.",
              1,
              true,
              "Balanced metrics stop teams from optimising one dimension at the expense of another.",
            ),
          ],
        },
      },
    ],
  },
  {
    slug: "clear-workplace-communication",
    title: "Clear Workplace Communication",
    summary: "Write sharper messages and run meetings people are glad they attended.",
    description:
      "Short, practical lessons on writing clearly, giving feedback and running efficient meetings — the habits that make teams faster.",
    category: "Communication",
    level: "beginner",
    coverTheme: "amber",
    status: "published",
    instructor: "maya",
    modules: [
      {
        title: "Writing That Works",
        lessons: [
          {
            title: "Structure your message",
            minutes: 5,
            content: `Open with the **point**, follow with the **context**, close with the **ask**. Readers should know within two sentences why they are reading and what you need from them.`,
          },
          {
            title: "Email etiquette",
            minutes: 5,
            content: `Use a subject line that states the purpose ("Decision needed by Fri: vendor choice"). Keep To for people who must act and Cc for those who need awareness. Reply-all sparingly.`,
          },
        ],
        quiz: {
          title: "Writing quiz",
          questions: [
            single(
              "What belongs at the very start of a work message?",
              0,
              "The main point",
              ["A long background story", "An apology", "The sign-off"],
              "Lead with the point so readers can prioritise.",
            ),
            single(
              "Who belongs on the To line of an email?",
              1,
              "People who need to take action",
              ["Everyone in the department", "Only your manager", "Anyone who might be curious"],
              "To is for action-takers; Cc is for awareness.",
            ),
            trueFalse(
              "A good subject line states the purpose and any deadline.",
              1,
              true,
              "Specific subject lines make messages easy to triage and find later.",
            ),
          ],
        },
      },
      {
        title: "Meetings & Feedback",
        lessons: [
          {
            title: "Running a focused meeting",
            minutes: 6,
            content: `Every meeting needs a purpose, an agenda, an owner and a clear list of decisions and actions at the end. If it can be an email, make it an email.`,
          },
          {
            title: "Giving useful feedback",
            minutes: 6,
            content: `Use the **SBI** model: describe the **Situation**, the **Behaviour** you observed, and the **Impact** it had. Stick to observable facts, not assumptions about intent.`,
          },
        ],
        quiz: {
          title: "Meetings & Feedback quiz",
          questions: [
            single(
              "What should a meeting end with?",
              0,
              "Clear decisions and owned actions",
              ["A promise to meet again", "A longer agenda", "Silence"],
              "Meetings exist to produce decisions and actions.",
            ),
            multi(
              "What does the SBI feedback model stand for?",
              1,
              ["Situation", "Behaviour", "Impact"],
              ["Sentiment", "Blame"],
              "Situation, Behaviour, Impact.",
            ),
            single(
              "Good feedback focuses on…",
              1,
              "Observable behaviour",
              ["Assumed intent", "Personality traits", "Rumours"],
              "Observable behaviour is specific and actionable.",
            ),
          ],
        },
      },
    ],
  },
  {
    slug: "cybersecurity-awareness",
    title: "Cybersecurity Awareness",
    summary: "Spot phishing, protect accounts and know exactly what to do when something looks wrong.",
    description:
      "Security is a team habit. This course covers the threats employees actually meet and the small behaviours that stop most breaches.",
    category: "Security",
    level: "beginner",
    coverTheme: "emerald",
    status: "published",
    instructor: "jonas",
    modules: [
      {
        title: "Know the Threats",
        lessons: [
          {
            title: "Recognising phishing",
            minutes: 6,
            content: `Phishing messages create **urgency**, impersonate someone you trust, and push you to click or share credentials.\n\n## Red flags\n- Mismatched sender address or link destination\n- Unexpected attachments\n- Pressure to act immediately\n\nHover before you click, and verify through a second channel.`,
          },
          {
            title: "Passwords and MFA",
            minutes: 6,
            content: `Use a **password manager** with long, unique passwords, and turn on **multi-factor authentication (MFA)** everywhere. MFA blocks most account takeovers even when a password leaks.`,
          },
        ],
        quiz: {
          title: "Threats quiz",
          questions: [
            multi(
              "Which are common phishing red flags?",
              0,
              ["Pressure to act immediately", "A link that doesn't match the sender"],
              ["A personal greeting by name only", "Correct company logo"],
              "Urgency and mismatched links are classic phishing indicators.",
            ),
            single(
              "What best protects an account if its password leaks?",
              1,
              "Multi-factor authentication",
              ["A longer username", "Changing the browser", "Clearing cookies"],
              "MFA requires a second factor so a stolen password alone is not enough.",
            ),
            trueFalse(
              "Reusing one strong password across all sites is safe.",
              1,
              false,
              "One breach would expose every account; use unique passwords.",
            ),
          ],
        },
      },
      {
        title: "Everyday Habits",
        lessons: [
          {
            title: "Keeping devices safe",
            minutes: 5,
            content: `Install updates promptly, lock your screen when you step away, and never plug in unknown USB devices. Use only approved software on work devices.`,
          },
          {
            title: "Reporting incidents",
            minutes: 4,
            content: `If you click something suspicious, **report it immediately** — speed matters far more than blame. Disconnect from the network if told to, and do not try to fix it yourself.`,
          },
        ],
        quiz: {
          title: "Habits quiz",
          questions: [
            single(
              "You clicked a suspicious link. What should you do first?",
              1,
              "Report it to IT security immediately",
              ["Delete the email and say nothing", "Wait to see if anything happens", "Forward it to colleagues"],
              "Fast reporting limits damage; hiding it makes things worse.",
            ),
            trueFalse(
              "It is fine to plug in a USB stick you found in the car park.",
              0,
              false,
              "Unknown devices can carry malware.",
            ),
            single(
              "Why install software updates promptly?",
              0,
              "They fix known security vulnerabilities",
              ["They make the device slower", "They remove the need for passwords", "They are optional cosmetic changes"],
              "Updates patch vulnerabilities attackers actively exploit.",
            ),
          ],
        },
      },
    ],
  },
  {
    slug: "facilitation-skills",
    title: "Facilitation Skills",
    summary: "Lead workshops that surface ideas and end with decisions.",
    description: "A draft course in progress — facilitation basics for leading productive group sessions.",
    category: "Leadership",
    level: "intermediate",
    coverTheme: "rose",
    status: "draft",
    instructor: "maya",
    modules: [
      {
        title: "Facilitation Basics",
        lessons: [
          {
            title: "The facilitator's role",
            minutes: 5,
            content: `A facilitator guides the **process** so the group can focus on the **content**. You stay neutral, keep time, and make sure every voice is heard.`,
          },
          {
            title: "Designing an agenda",
            minutes: 6,
            content: `Start with the outcome you want, then work backwards: opening, divergent thinking, convergence, decisions, close.`,
          },
        ],
        quiz: {
          title: "Facilitation basics quiz",
          questions: [
            single(
              "A facilitator primarily guides the…",
              0,
              "Process",
              ["Content", "Budget", "Seating plan"],
              "Facilitators manage how the group works so the group can own what it decides.",
            ),
            trueFalse(
              "An agenda should start from the desired outcome.",
              1,
              true,
              "Designing backwards from the outcome keeps sessions purposeful.",
            ),
          ],
        },
      },
    ],
  },
];
