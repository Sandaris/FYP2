"""
Charts for Chapter 6.1 (Result Evaluation) -- Objective 1 model comparison.

Numbers are taken verbatim from Table 92 / Table 94 in the report (test-set, Year==2026,
already verified against Model Selection/*.ipynb earlier in the documentation audit).
Multiple Linear Regression is shown for R² only (in-sample fit -- it has no held-out 2026
test metric, so it is excluded from the MedAE comparison).
"""
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

OUT_DIR = r"C:\Users\User\Documents\APU\FYP2\Code"

DEPLOYED_COLOR = "#2f9e44"
NOT_DEPLOYED_COLOR = "#adb5bd"
MLR_COLOR = "#495057"

# ---------------------------------------------------------------------------
# Chart 1: Test R^2 across all six models vs the Objective 1 threshold (0.80)
# ---------------------------------------------------------------------------
models_r2 = ["MLR\n(in-sample)", "LSTM", "Regression\nTree", "XGBoost", "Random\nForest", "FT-Transformer"]
r2 = [0.843, 0.770, 0.772, 0.807, 0.820, 0.833]
deployed = [False, False, False, True, True, True]
colors_r2 = [MLR_COLOR if m.startswith("MLR") else (DEPLOYED_COLOR if d else NOT_DEPLOYED_COLOR)
             for m, d in zip(models_r2, deployed)]

fig, ax = plt.subplots(figsize=(8.8, 4.8), dpi=200)
bars = ax.bar(models_r2, r2, color=colors_r2, width=0.6, edgecolor="white", linewidth=0.5)
ax.axhline(0.80, color="firebrick", linestyle="--", linewidth=1.4, zorder=0)
ax.text(5.55, 0.803, "Objective 1 target: R² ≥ 0.80", ha="right", va="bottom",
        color="firebrick", fontsize=8.8, fontweight="bold")

for b, v in zip(bars, r2):
    ax.text(b.get_x() + b.get_width() / 2, v + 0.006, f"{v:.3f}",
             ha="center", fontsize=9.5, fontweight="bold")

ax.set_ylim(0.72, 0.88)
ax.set_ylabel("R² (log-price scale)")
ax.set_title("Objective 1 — Test R² by Model, vs. the 0.80 Target", fontsize=12, fontweight="bold")
ax.spines[["top", "right"]].set_visible(False)

legend_handles = [
    plt.Rectangle((0, 0), 1, 1, color=DEPLOYED_COLOR, label="Deployed to production"),
    plt.Rectangle((0, 0), 1, 1, color=NOT_DEPLOYED_COLOR, label="Evaluated, not deployed"),
    plt.Rectangle((0, 0), 1, 1, color=MLR_COLOR, label="In-sample only (not held-out tested)"),
]
ax.legend(handles=legend_handles, fontsize=8.3, loc="lower left", framealpha=0.9)

fig.text(0.5, -0.02,
          "Test R² is measured on the held-out 2026 transaction set (Chapter 4, Section 5.2), except MLR which is in-sample.",
          ha="center", fontsize=8, style="italic", color="#555555")

plt.tight_layout()
plt.savefig(f"{OUT_DIR}/obj1_r2_comparison.png", bbox_inches="tight", facecolor="white")
plt.close(fig)
print("saved obj1_r2_comparison.png")

# ---------------------------------------------------------------------------
# Chart 2: Median absolute error (RM) for the three deployed production models
# ---------------------------------------------------------------------------
models_medae = ["XGBoost\n(default)", "Random Forest", "FT-Transformer"]
medae = [58880, 51615, 51434]
colors_medae = [DEPLOYED_COLOR] * 3

fig, ax = plt.subplots(figsize=(6.8, 4.6), dpi=200)
bars = ax.barh(models_medae, medae, color=colors_medae, height=0.55, edgecolor="white", linewidth=0.5)
for b, v in zip(bars, medae):
    ax.text(v + 1200, b.get_y() + b.get_height() / 2, f"RM {v:,.0f}",
             va="center", fontsize=10, fontweight="bold")

ax.set_xlim(0, 72000)
ax.set_xlabel("Median Absolute Error (RM), 2026 test set")
ax.set_title("Objective 1 — Deployed Models' Median Absolute Error", fontsize=12, fontweight="bold")
ax.spines[["top", "right"]].set_visible(False)
ax.invert_yaxis()

plt.tight_layout()
plt.savefig(f"{OUT_DIR}/obj1_medae_comparison.png", bbox_inches="tight", facecolor="white")
plt.close(fig)
print("saved obj1_medae_comparison.png")
