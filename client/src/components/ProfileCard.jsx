const CATEGORY_LABELS = {
  sc: "SC",
  st: "ST",
  obc: "OBC",
  general: "General",
  minority: "Minority",
};

const EDUCATION_LABELS = {
  higher_education: "Higher education",
  school: "School",
};

const INTENT_LABELS = {
  student: "Student support",
  business: "Business",
  job: "Employment",
  medical: "Medical",
  treatment: "Treatment",
  loan: "Loan",
  scholarship: "Scholarship",
  marriage: "Marriage",
  death: "Death benefit",
  disability: "Disability",
  maternity: "Maternity",
  farmer: "Farming",
  unemployed: "Unemployment",
  "startup-funding": "Startup funding",
  "widow-support": "Widow support",
  housing: "Housing",
  sanitation: "Sanitation",
  pension: "Pension",
};

const humanize = (value) =>
  String(value)
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

const ProfileCard = ({ profile }) => {
  if (!profile) return null;

  const known = (v) => v !== null && v !== undefined && v !== "" && v !== "unknown";

  const fields = [
    { label: "Age", value: known(profile.age) ? `${profile.age} years` : null, icon: "◷" },
    { label: "Gender", value: known(profile.gender) ? humanize(profile.gender) : null, icon: "⚤" },
    { label: "Occupation", value: known(profile.occupation) ? humanize(profile.occupation) : null, icon: "⚒" },
    { label: "State", value: known(profile.state) ? humanize(profile.state) : null, icon: "⊕" },
    {
      label: "Annual income",
      value: known(profile.income)
        ? `₹${Number(profile.income).toLocaleString("en-IN")}`
        : null,
      icon: "₹",
    },
    {
      label: "Education",
      value: known(profile.educationLevel)
        ? EDUCATION_LABELS[profile.educationLevel] || humanize(profile.educationLevel)
        : null,
      icon: "◎",
    },
    {
      label: "Category",
      value: known(profile.casteCategory)
        ? CATEGORY_LABELS[profile.casteCategory] || humanize(profile.casteCategory)
        : null,
      icon: "⬡",
    },
    {
      label: "Looking for",
      value: known(profile.primaryIntent)
        ? INTENT_LABELS[profile.primaryIntent] || humanize(profile.primaryIntent)
        : null,
      icon: "→",
    },
  ].filter((f) => f.value);

  if (fields.length === 0) return null;

  return (
    <div className="readout">
      <p className="readout__title">What we understood from your description</p>
      <dl className="readout__grid">
        {fields.map((f) => (
          <div className="readout__item" key={f.label}>
            <dt>
              <i aria-hidden="true">{f.icon}</i>
              {f.label}
            </dt>
            <dd>{f.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
};

export default ProfileCard;
