// Shared representative query set for regression / quality evaluation.
// Covers the UI examples plus every tuned intent path (widow, cancer/loan,
// study-abroad, startup-funding, farmer, reserved-category) so a change in
// retrieval surfaces regressions.
export const EVAL_QUERIES = [
  { id: "q01", label: "student scholarship Delhi", q: "I'm a 22-year-old female student from Delhi looking for scholarships" },
  { id: "q02", label: "farmer crop insurance", q: "Farmer from Maharashtra needing crop insurance support" },
  { id: "q03", label: "unemployed skill training", q: "Unemployed youth from Bihar seeking skill training and stipend" },
  { id: "q04", label: "education financial aid", q: "I am a 22-year-old woman from Delhi looking for financial assistance for education" },
  { id: "q05", label: "widow support Delhi", q: "Financial assistance for widows in Delhi" },
  { id: "q06", label: "father cancer loan", q: "Loan for my father's cancer treatment, family income less than 3 lakh" },
  { id: "q07", label: "study abroad girl UP", q: "Scholarship for study abroad, I am a girl from Uttar Pradesh" },
  { id: "q08", label: "general cat engineering", q: "I am a general category engineering student, need tuition fee scholarship" },
  { id: "q09", label: "mother widow pension", q: "Widow pension for my mother who is 55 years old, from Rajasthan" },
  { id: "q10", label: "woman startup funding", q: "Startup seed funding for a woman entrepreneur in Karnataka" },
];
