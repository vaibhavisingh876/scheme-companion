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
      <div className="scheme-icon orange">
        ✦
      </div>

      <span className="scheme-category">
        {scheme.category || "General"}
      </span>
    </div>

    <h3>
      {scheme.name}
    </h3>

    <p>
      {scheme.description || "Government benefit scheme. View details to learn more."}
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
          scheme.applicationLink ||
          "https://www.myscheme.gov.in"
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


const LandingHome = ({
  onViewDetails,
  onTabChange,
}) => {
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
        console.error(
          "Backend connection failure:",
          err
        );
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);


  useEffect(() => {
    const elements =
      document.querySelectorAll(".scroll-reveal");

    if (!elements.length) return;

    const observer =
      new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add(
                "is-visible"
              );

              observer.unobserve(
                entry.target
              );
            }
          });
        },
        {
          threshold: 0.12,
        }
      );

    elements.forEach((element) =>
      observer.observe(element)
    );

    return () =>
      observer.disconnect();
  }, [popularSchemes]);


  const goToSearch = () => {
    onTabChange?.("search");
  };


  const scrollToHowItWorks = () => {
    document
      .getElementById("how-it-works")
      ?.scrollIntoView({
        behavior: "smooth",
      });
  };


  return (
    <div className="landing-page">

      {/* =====================================================
          HERO
      ===================================================== */}

      <section className="hero-section">

        {/* Animated background */}

        <div className="hero-grid" />
        <div className="hero-noise" />

        <div className="hero-glow hero-glow-left" />
        <div className="hero-glow hero-glow-right" />


        <div className="hero-container">

          {/* =================================================
              LEFT — HERO COPY
          ================================================= */}

          <div className="hero-copy">

            <div className="hero-badge animate-fade-up">

              <span className="badge-live-dot" />

              <span>
                AI-powered scheme discovery
              </span>

              <span className="badge-arrow">
                ✦
              </span>

            </div>


            <h1 className="hero-title animate-fade-up stagger-1">

              Government benefits,
              <br />

              <span>
                matched to your life.
              </span>

            </h1>


            <p className="hero-description animate-fade-up stagger-2">

              Explore{" "}

              <strong>
                4,700+ government schemes
              </strong>

              {" "}and discover benefits relevant
              to your profile, needs and
              circumstances.

            </p>


            <div className="hero-actions animate-fade-up stagger-3">

              <button
                type="button"
                className="hero-primary-button"
                onClick={goToSearch}
              >
                <span>
                  Find schemes for me
                </span>

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


            <div className="hero-trust animate-fade-up stagger-4">

              <div className="trust-avatars">

                <span>AI</span>
                <span>✓</span>
                <span>4K</span>

              </div>


              <div>

                <div className="trust-title">
                  Built for simpler discovery
                </div>

                <div className="trust-subtitle">
                  Less searching. More relevant schemes.
                </div>

              </div>

            </div>

          </div>


          {/* =================================================
              RIGHT — GIANT CHAKRA
          ================================================= */}

          <div
            className="hero-visual animate-fade-in"
            aria-hidden="true"
          >

            <div className="hero-chakra-wrap">

              {/* Glow */}

              <div className="chakra-halo" />
              <div className="chakra-halo halo-two" />


              {/* Outer orbit */}

              <div className="chakra-orbit">

                <span className="orbit-dot dot-one" />
                <span className="orbit-dot dot-two" />

              </div>


              {/* Middle orbit */}

              <div className="chakra-orbit orbit-two">

                <span className="orbit-dot dot-three" />
                <span className="orbit-dot dot-four" />

              </div>


              {/* Inner orbit */}

              <div className="chakra-orbit orbit-three">

                <span className="orbit-dot dot-five" />

              </div>


              {/* Chakra outer ring */}

              <div className="chakra-ring">

                <span />
                <span />
                <span />
                <span />

              </div>


              {/* Chakra middle ring */}

              <div className="chakra-ring ring-middle">

                <span />
                <span />
                <span />
                <span />

              </div>


              {/* Chakra inner ring */}

              <div className="chakra-ring ring-inner">

                <span />
                <span />
                <span />
                <span />

              </div>


              {/* =================================================
                  CENTER
              ================================================= */}

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
                  AI MATCH
                </div>

              </div>


              {/* =================================================
                  FLOATING CATEGORY CHIPS
              ================================================= */}

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


        {/* =====================================================
            HERO STATS
        ===================================================== */}

        <div className="hero-bottom">

          <div className="hero-stats">

            <StatPill
              value="4,700+"
              label="Government schemes"
            />

            <div className="stat-divider" />

            <StatPill
              value="28+"
              label="States & UTs"
            />

            <div className="stat-divider" />

            <StatPill
              value="AI"
              label="Powered matching"
            />

          </div>


          <div className="scroll-indicator">

            <span>
              Scroll to explore
            </span>

            <div className="scroll-line">
              <span />
            </div>

          </div>

        </div>

      </section>


      {/* =====================================================
          INTRO
      ===================================================== */}

      <section className="intro-section">

        <div className="section-container">

          <div className="intro-grid">

            <div className="scroll-reveal">

              <span className="section-eyebrow">
                WHY SCHEME COMPANION
              </span>

              <h2 className="intro-heading">

                Government schemes
                <br />

                shouldn't feel like
                <br />

                <span>
                  a treasure hunt.
                </span>

              </h2>

            </div>


            <div className="intro-copy scroll-reveal">

              <p>
                India has thousands of government
                schemes, but finding the ones you can
                actually benefit from can mean searching
                through endless pages and complicated
                eligibility rules.
              </p>

              <p>
                <em>
                  Scheme Companion
                </em>{" "}
                turns that complexity into a simpler
                discovery experience — helping you move
                from{" "}
                <em>
                  "What's available?"
                </em>{" "}
                to{" "}
                <em>
                  "What's relevant to me?"
                </em>
              </p>

            </div>

          </div>

        </div>

      </section>


      {/* =====================================================
          HOW IT WORKS
      ===================================================== */}

      <section
        className="how-section"
        id="how-it-works"
      >

        <div className="section-container">

          <div className="section-heading scroll-reveal">

            <span className="section-eyebrow">
              HOW IT WORKS
            </span>

            <h2>

              From your story
              <br />

              to the right{" "}

              <span>
                schemes.
              </span>

            </h2>

            <p>
              No complicated forms. Tell us about
              yourself and let the system help narrow
              down the possibilities.
            </p>

          </div>


          <div className="steps-wrapper">

            <div className="steps-line">
              <div className="steps-line-progress" />
            </div>


            <div className="steps-grid">

              {/* STEP 01 */}

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
                  Describe yourself
                </h3>

                <p>
                  Tell the AI about your profile,
                  circumstances, location and what
                  kind of support you're looking for.
                </p>

                <span className="step-tag">
                  Your profile
                </span>

              </article>


              {/* STEP 02 */}

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

                    <path
                      d="m20 20-4-4"
                    />

                    <path
                      d="M8.5 11h5M11 8.5v5"
                    />

                  </svg>

                </div>

                <h3>
                  AI finds the fit
                </h3>

                <p>
                  Your information is processed against
                  scheme information to surface options
                  that are more relevant to you.
                </p>

                <span className="step-tag">
                  Smart matching
                </span>

              </article>


              {/* STEP 03 */}

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

                    <path
                      d="m7 12 3 3 7-7"
                    />

                  </svg>

                </div>

                <h3>
                  Explore & apply
                </h3>

                <p>
                  Review matched schemes, understand
                  their details and continue to the
                  official application process.
                </p>

                <span className="step-tag">
                  Take action
                </span>

              </article>

            </div>

          </div>

        </div>

      </section>


      {/* =====================================================
          AI FEATURE BANNER
      ===================================================== */}

      <section className="feature-section">

        <div className="section-container">

          <div className="feature-banner scroll-reveal">

            <div className="feature-grid-bg" />


            <div className="feature-content">

              <div className="feature-mini-label">

                <span className="feature-dot" />

                INTELLIGENT DISCOVERY

              </div>


              <h2>

                Thousands of schemes.
                <br />

                One{" "}

                <span>
                  smarter starting point.
                </span>

              </h2>


              <p>
                Instead of manually checking thousands
                of scheme pages, start with your own
                profile and let Scheme Companion help
                you discover relevant possibilities.
              </p>


              <button
                type="button"
                className="feature-button"
                onClick={goToSearch}
              >
                Start discovering

                <span>
                  →
                </span>

              </button>

            </div>


            {/* Mini AI dashboard */}

            <div className="feature-visual">

              <div className="mini-dashboard">

                <div className="mini-dashboard-top">

                  <span>
                    AI MATCHING
                  </span>

                  <span className="mini-live">
                    ● LIVE
                  </span>

                </div>


                <div className="mini-match">

                  <div className="mini-match-icon">
                    🎓
                  </div>

                  <div className="mini-match-info">

                    <strong>
                      Education support
                    </strong>

                    <span>
                      Student · Higher education
                    </span>

                  </div>

                  <div className="mini-check">
                    ✓
                  </div>

                </div>


                <div className="mini-match">

                  <div className="mini-match-icon">
                    🏥
                  </div>

                  <div className="mini-match-info">

                    <strong>
                      Healthcare support
                    </strong>

                    <span>
                      Health · Family
                    </span>

                  </div>

                  <div className="mini-check">
                    ✓
                  </div>

                </div>


                <div className="mini-match">

                  <div className="mini-match-icon">
                    💼
                  </div>

                  <div className="mini-match-info">

                    <strong>
                      Employment support
                    </strong>

                    <span>
                      Career · Enterprise
                    </span>

                  </div>

                  <div className="mini-check">
                    ✓
                  </div>

                </div>


                <div
                  style={{
                    marginTop: "12px",
                    padding: "9px 11px",
                    borderRadius: "9px",
                    background:
                      "rgba(255,145,65,.07)",
                    border:
                      "1px solid rgba(255,145,65,.1)",
                    color:
                      "rgba(255,255,255,.38)",
                    fontSize: "8px",
                    lineHeight: 1.5,
                  }}
                >
                  Matching your profile with relevant
                  eligibility signals...
                </div>

              </div>

            </div>

          </div>

        </div>

      </section>


      {/* =====================================================
          LIVE POPULAR SCHEMES
      ===================================================== */}

      <section className="popular-section">

        <div className="section-container">

          <div className="popular-heading scroll-reveal">

            <div>

              <span className="section-eyebrow">
                LIVE FROM THE DATABASE
              </span>

              <h2>

                Popular{" "}

                <span>
                  schemes.
                </span>

              </h2>

            </div>


            <button
              type="button"
              className="view-all-button"
              onClick={goToSearch}
            >
              Explore all schemes

              <span>
                →
              </span>

            </button>

          </div>


          {loading ? (

            <div className="scheme-grid">

              {[1, 2, 3, 4, 5, 6].map(
                (item) => (
                  <div
                    key={item}
                    className="h-[290px] rounded-[20px] skeleton"
                  />
                )
              )}

            </div>

          ) : popularSchemes.length === 0 ? (

            <div
              className="text-center py-16 rounded-2xl scroll-reveal is-visible"
              style={{
                border:
                  "1px dashed var(--border)",
                background:
                  "var(--surface)",
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
                Please check your connection and
                try again.
              </p>

            </div>

          ) : (

            <div className="scheme-grid">

              {popularSchemes.map(
                (scheme, index) => (

                  <div
                    key={
                      scheme.id ||
                      `${scheme.name}-${index}`
                    }
                    className="scroll-reveal"
                    style={{
                      transitionDelay:
                        `${index * 70}ms`,
                    }}
                  >

                    <SchemeCard
                      scheme={scheme}
                      onViewDetails={
                        onViewDetails
                      }
                    />

                  </div>

                )
              )}

            </div>

          )}

        </div>

      </section>


      {/* =====================================================
          FINAL CTA
      ===================================================== */}

      <section className="final-cta-section">

        <div className="final-cta-glow" />

        <div className="final-cta-ring ring-a" />
        <div className="final-cta-ring ring-b" />


        <div className="section-container">

          <div className="final-cta scroll-reveal">

            <span className="section-eyebrow">

              YOUR BENEFITS ARE OUT THERE

            </span>


            <h2>

              Let's find what

              <br />

              <span>
                fits you.
              </span>

            </h2>


            <p>
              Start with a few details and discover
              government schemes that may be relevant
              to your journey.
            </p>


            <button
              type="button"
              className="final-cta-button"
              onClick={goToSearch}
            >
              Find my schemes

              <span>
                →
              </span>

            </button>

          </div>

        </div>

      </section>

    </div>
  );
};


export default LandingHome;
