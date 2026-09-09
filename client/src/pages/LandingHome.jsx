import { useEffect, useState } from "react";
import { getPaginatedSchemes } from "../services/api";

const StatPill = ({ value, label }) => (
  <div className="text-center">
    <p
      className="text-2xl md:text-3xl font-black"
      style={{
        fontFamily: "'JetBrains Mono', monospace",
        color: "var(--saffron)",
      }}
    >
      {value}
    </p>

    <p
      className="text-[9px] md:text-[10px] uppercase tracking-widest mt-1"
      style={{
        color: "rgba(255,255,255,0.42)",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {label}
    </p>
  </div>
);

const SchemeCard = ({ scheme, onViewDetails }) => (
  <div
    className="scheme-card group"
    onClick={() => onViewDetails?.(scheme)}
  >
    <div className="scheme-card-glow orange" />

    <div className="scheme-card-top">
      <div className="scheme-icon orange">✦</div>

      <span className="scheme-category">
        {scheme.category || "General"}
      </span>
    </div>

    <h3>{scheme.name}</h3>

    <p>
      {scheme.description ||
        "Government benefit scheme. View details to learn more."}
    </p>

    <div
      className="scheme-card-bottom"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginTop: "22px",
        paddingTop: "14px",
        borderTop: "1px solid var(--border)",
      }}
    >
      <span
        style={{
          color: "var(--muted)",
          fontSize: "10px",
          fontWeight: 700,
        }}
      >
        📍 {scheme.state || "All India"}
      </span>

      <a
        href={
          scheme.applicationLink || "https://www.myscheme.gov.in"
        }
        target="_blank"
        rel="noreferrer"
        className="scheme-explore"
        onClick={(e) => e.stopPropagation()}
      >
        Apply
        <span>↗</span>
      </a>
    </div>
  </div>
);

const LandingHome = ({ onViewDetails, onTabChange }) => {
  const [popularSchemes, setPopularSchemes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPaginatedSchemes(1, 6)
      .then((data) => {
        if (data?.schemes) {
          setPopularSchemes(data.schemes);
        }
      })
      .catch((err) => {
        console.error("Backend connection failure:", err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    const elements = document.querySelectorAll(".scroll-reveal");

    if (!elements.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.12,
      }
    );

    elements.forEach((element) => observer.observe(element));

    return () => observer.disconnect();
  }, [popularSchemes]);

  const goToSearch = () => {
    onTabChange?.("search");
  };

  const scrollToHowItWorks = () => {
    document.getElementById("how-it-works")?.scrollIntoView({
      behavior: "smooth",
    });
  };

  return (
    <div className="landing-page">

      {/* HERO */}

      <section className="hero-section">
        <div className="hero-grid" />
        <div className="hero-noise" />

        <div className="hero-glow hero-glow-left" />
        <div className="hero-glow hero-glow-right" />

        <div className="hero-container">

          <div className="hero-copy">

            <h1 className="hero-title animate-fade-up stagger-1">
              Most people qualify for
              <br />

              <span>a scheme they've never heard of.</span>
            </h1>

            <p className="hero-description animate-fade-up stagger-2">
              Central and state governments run thousands of
              programs — scholarships, pensions, subsidies,
              insurance — and most of them go unclaimed simply
              because nobody knew to look. Tell us about your
              situation and we'll show you what applies.
            </p>

            <div className="hero-actions animate-fade-up stagger-3">

              <button
                type="button"
                className="hero-primary-button"
                onClick={goToSearch}
              >
                <span>Find my schemes</span>

                <span className="button-arrow">
                  →
                </span>
              </button>

              <button
                type="button"
                className="hero-secondary-button"
                onClick={scrollToHowItWorks}
              >
                <span>↓</span>
                See how it works
              </button>

            </div>

          </div>

          {/* CHAKRA — KEEPING THIS AS THE MAIN VISUAL */}

          <div
            className="hero-visual animate-fade-in"
            aria-hidden="true"
          >
            <div className="hero-chakra-wrap">

              <div className="chakra-halo" />
              <div className="chakra-halo halo-two" />

              <div className="chakra-orbit">
                <span className="orbit-dot dot-one" />
                <span className="orbit-dot dot-two" />
              </div>

              <div className="chakra-orbit orbit-two">
                <span className="orbit-dot dot-three" />
                <span className="orbit-dot dot-four" />
              </div>

              <div className="chakra-orbit orbit-three">
                <span className="orbit-dot dot-five" />
              </div>

              <div className="chakra-ring">
                <span />
                <span />
                <span />
                <span />
              </div>

              <div className="chakra-ring ring-middle">
                <span />
                <span />
                <span />
                <span />
              </div>

              <div className="chakra-ring ring-inner">
                <span />
                <span />
                <span />
                <span />
              </div>

              <div className="chakra-core">

                <div className="core-pulse" />

                <div className="core-icon">
                  <svg
                    viewBox="0 0 100 100"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <circle
                      cx="50"
                      cy="50"
                      r="38"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      opacity=".28"
                    />

                    <circle
                      cx="50"
                      cy="50"
                      r="27"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      opacity=".5"
                    />

                    <circle
                      cx="50"
                      cy="50"
                      r="8"
                      fill="currentColor"
                    />

                    <path
                      d="M50 10V31"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />

                    <path
                      d="M50 69V90"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />

                    <path
                      d="M10 50H31"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />

                    <path
                      d="M69 50H90"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />

                    <path
                      d="M22 22L37 37"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />

                    <path
                      d="M63 63L78 78"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />

                    <path
                      d="M78 22L63 37"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />

                    <path
                      d="M37 63L22 78"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>

                <div className="core-label">
                  MATCH
                </div>

              </div>

              {/* Subtle category labels */}

              <div className="floating-chip chip-education">
                <span>🎓</span>
                Education
              </div>

              <div className="floating-chip chip-health">
                <span>🏥</span>
                Healthcare
              </div>

              <div className="floating-chip chip-women">
                <span>👩</span>
                Women
              </div>

              <div className="floating-chip chip-farm">
                <span>🌾</span>
                Agriculture
              </div>

            </div>
          </div>
        </div>

        {/* SIMPLE STATS */}

        <div className="hero-bottom">

          <div className="hero-stats">

            <StatPill
              value="4,700+"
              label="Government schemes"
            />

            <div className="stat-divider" />

            <StatPill
              value="AI"
              label="Scheme matching"
            />

          </div>

          <div className="scroll-indicator">
            <span>Scroll to explore</span>

            <div className="scroll-line">
              <span />
            </div>
          </div>

        </div>
      </section>

      {/* INTRO */}

      <section className="intro-section">

        <div className="section-container">

          <div className="intro-grid">

            <div className="scroll-reveal">

              <h2 className="intro-heading">
                There's a scheme for almost
                <br />
                everything. Finding it
                <br />

                <span>is the hard part.</span>
              </h2>

            </div>

            <div className="intro-copy scroll-reveal">

              <p>
                Housing, education, farming, healthcare,
                pensions — programs exist for most of it,
                spread across central and state departments,
                each with its own paperwork and cut-off
                dates.
              </p>

              <p>
                Scheme Companion asks a few questions about
                who you are and where you live, then narrows
                thousands of listings down to the ones that
                actually apply to you.
              </p>

            </div>

          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}

      <section
        className="how-section"
        id="how-it-works"
      >

        <div className="section-container">

          <div className="section-heading scroll-reveal">

            <h2>
              Three steps,
              <br />

              <span>start to finish.</span>
            </h2>

            <p>
              No account required to browse. A few details
              about yourself just narrows the list faster.
            </p>

          </div>

          <div className="steps-wrapper">

            <div className="steps-line">
              <div className="steps-line-progress" />
            </div>

            <div className="steps-grid">

              <article className="step-card scroll-reveal">

                <span className="step-number">
                  01
                </span>

                <div className="step-icon">

                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      cx="12"
                      cy="7"
                      r="4"
                    />

                    <path
                      d="M4 21a8 8 0 0 1 16 0"
                    />
                  </svg>

                </div>

                <h3>
                  Tell us about yourself
                </h3>

                <p>
                  Age, occupation, state, income bracket —
                  the details that actually decide what
                  you're eligible for.
                </p>

              </article>

              <article className="step-card scroll-reveal">

                <span className="step-number">
                  02
                </span>

                <div className="step-icon">

                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      cx="11"
                      cy="11"
                      r="7"
                    />

                    <path d="m20 20-4-4" />

                    <path d="M8.5 11h5M11 8.5v5" />
                  </svg>

                </div>

                <h3>
                  See what you match
                </h3>

                <p>
                  We check your details against scheme
                  eligibility rules and rank what's actually
                  worth reading.
                </p>

              </article>

              <article className="step-card scroll-reveal">

                <span className="step-number">
                  03
                </span>

                <div className="step-icon">

                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <rect
                      x="3"
                      y="3"
                      width="18"
                      height="18"
                      rx="4"
                    />

                    <path d="m7 12 3 3 7-7" />
                  </svg>

                </div>

                <h3>
                  Apply on the official site
                </h3>

                <p>
                  We link straight to the government
                  page for each scheme — we don't process
                  applications ourselves.
                </p>

              </article>

            </div>
          </div>
        </div>
      </section>

      {/* DISCOVERY SECTION */}

      <section className="feature-section">

        <div className="section-container">

          <div
            className="feature-banner scroll-reveal"
            style={{
              gridTemplateColumns: "1fr",
            }}
          >

            <div className="feature-grid-bg" />

            <div
              className="feature-content"
              style={{
                maxWidth: "700px",
              }}
            >

              <h2>
                You don't need to know
                <br />

                <span>what a scheme is called.</span>
              </h2>

              <p>
                Most people don't discover a scheme by
                its name — they discover it because it
                fits their state, their job, or their
                income. Search by those instead, and let
                the database do the matching.
              </p>

              <button
                type="button"
                className="feature-button"
                onClick={goToSearch}
              >
                Search by your details
              </button>

            </div>

          </div>
        </div>
      </section>

      {/* POPULAR SCHEMES */}

      <section className="popular-section">

        <div className="section-container">

          <div className="popular-heading scroll-reveal">

            <div>

              <h2>
                A few schemes people
                <br />

                <span>are checking out right now.</span>
              </h2>

            </div>

            <button
              type="button"
              className="view-all-button"
              onClick={goToSearch}
            >
              See the full list
            </button>

          </div>

          {loading ? (

            <div className="scheme-grid">

              {[1, 2, 3, 4, 5, 6].map((item) => (
                <div
                  key={item}
                  className="h-[290px] rounded-[20px] skeleton"
                />
              ))}

            </div>

          ) : popularSchemes.length === 0 ? (

            <div
              className="text-center py-16 rounded-2xl scroll-reveal is-visible"
              style={{
                border: "1px dashed var(--border)",
                background: "var(--surface)",
              }}
            >

              <div
                style={{
                  fontSize: "30px",
                  marginBottom: "12px",
                }}
              >
                ◌
              </div>

              <p
                className="text-sm font-semibold"
                style={{
                  color: "var(--ink)",
                }}
              >
                Schemes couldn't be loaded
              </p>

              <p
                className="text-xs mt-1"
                style={{
                  color: "var(--muted)",
                }}
              >
                Please check your connection and try again.
              </p>

            </div>

          ) : (

            <div className="scheme-grid">

              {popularSchemes.map((scheme, index) => (

                <div
                  key={
                    scheme.id ||
                    `${scheme.name}-${index}`
                  }
                  className="scroll-reveal"
                  style={{
                    transitionDelay: `${index * 50}ms`,
                  }}
                >

                  <SchemeCard
                    scheme={scheme}
                    onViewDetails={onViewDetails}
                  />

                </div>

              ))}

            </div>

          )}

        </div>
      </section>

      {/* FINAL CTA */}

      <section className="final-cta-section">

        <div className="final-cta-glow" />

        <div className="final-cta-ring ring-a" />
        <div className="final-cta-ring ring-b" />

        <div className="section-container">

          <div className="final-cta scroll-reveal">

            <h2>
              Chances are, one of these
              <br />

              <span>4,700 schemes is for you.</span>
            </h2>

            <p>
              Takes about two minutes to find out what fits you.
            </p>

            <button
              type="button"
              className="final-cta-button"
              onClick={goToSearch}
            >
              Check what I qualify for
            </button>

          </div>
        </div>
      </section>

    </div>
  );
};

export default LandingHome;