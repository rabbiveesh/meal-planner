//! Builds the two-week rotation from the user's own meals.

use rand::{Rng, SeedableRng};
use rand_chacha::ChaCha8Rng;
use serde::Serialize;
use tsify::Tsify;

use crate::kashrut::day_conflicts;
use crate::model::{Cell, Household, Meal, Plan, Prep, CYCLE_DAYS};

#[derive(Debug, Clone, Serialize, Tsify)]
#[serde(rename_all = "camelCase")]
pub struct MealOption {
    pub meal_id: String,
    pub name: String,
    /// Why this meal is a poor fit here. Empty means it fits.
    pub warnings: Vec<String>,
}

/// Days between two rotation days, wrapping around the cycle (the rotation repeats).
fn cycle_distance(a: u8, b: u8) -> u8 {
    let d = a.abs_diff(b);
    d.min(CYCLE_DAYS - d)
}

/// Every reason `meal` doesn't fit `slot_id` on `day`, given the rest of the plan.
pub fn warnings(h: &Household, plan: &Plan, day: u8, slot_id: &str, meal: &Meal) -> Vec<String> {
    let mut w = Vec::new();
    let weekday = day % 7;
    let Some(slot) = h.slot(slot_id) else {
        return vec!["Unknown slot".into()];
    };
    if !meal.slots.iter().any(|s| s == slot_id) {
        w.push(format!("Not usually a {}", slot.name));
    }
    if !meal.days.is_empty() && !meal.days.contains(&weekday) {
        w.push("Not set for this day of the week".into());
    }
    if slot_id == h.rules.main_slot_id
        && meal.prep == Prep::Fresh
        && !h.rules.fresh_days.contains(&weekday)
    {
        w.push("Needs cooking fresh, but this isn't a cook-fresh day".into());
    }
    let repeat = plan.cells.iter().find(|c| {
        c.slot_id == slot_id
            && c.day != day
            && !c.leftover
            && c.meal_id.as_deref() == Some(&meal.id)
            && cycle_distance(c.day, day) < slot.min_repeat_days
    });
    if let Some(c) = repeat {
        w.push(format!(
            "Already planned {} days away",
            cycle_distance(c.day, day)
        ));
    }
    if meal.fun
        && plan.cells.iter().any(|c| {
            !(c.day == day && c.slot_id == slot_id)
                && c.meal_id
                    .as_deref()
                    .and_then(|id| h.meal(id))
                    .is_some_and(|m| m.fun)
        })
    {
        w.push("Already one fun meal in this rotation".into());
    }
    for c in day_conflicts(h, plan, day, Some((slot_id, meal.kashrut))) {
        w.push(c.message);
    }
    w
}

/// All meals that could go in a cell, best fits first. Powers the manual swap list.
pub fn options(h: &Household, plan: &Plan, day: u8, slot_id: &str) -> Vec<MealOption> {
    let mut out: Vec<MealOption> = h
        .meals
        .iter()
        .filter(|m| m.slots.iter().any(|s| s == slot_id))
        .map(|m| MealOption {
            meal_id: m.id.clone(),
            name: m.name.clone(),
            warnings: warnings(h, plan, day, slot_id, m),
        })
        .collect();
    out.sort_by(|a, b| {
        a.warnings
            .len()
            .cmp(&b.warnings.len())
            .then(a.name.cmp(&b.name))
    });
    out
}

/// Fills every unlocked cell of the rotation. Locked cells are kept as they are.
pub fn generate(h: &Household, previous: &Plan, seed: u64) -> Plan {
    let mut rng = ChaCha8Rng::seed_from_u64(seed);
    let mut plan = Plan {
        cells: previous
            .cells
            .iter()
            .filter(|c| c.locked)
            .cloned()
            .collect(),
    };

    let mut slots: Vec<_> = h.slots.iter().collect();
    slots.sort_by_key(|s| {
        [&s.child_time, &s.adult_time]
            .iter()
            .filter_map(|t| t.as_deref().and_then(crate::model::minutes))
            .min()
            .unwrap_or(u32::MAX)
    });

    for day in 0..CYCLE_DAYS {
        for slot in &slots {
            if !h.slot_on_day(slot, day) || plan.cell(day, &slot.id).is_some() {
                continue;
            }
            let mut cell = Cell {
                day,
                slot_id: slot.id.clone(),
                ..Default::default()
            };

            // Cook double: yesterday's meal may already cover this slot.
            let yesterday = day.checked_sub(1);
            let leftover = yesterday.and_then(|d| {
                plan.cells.iter().find_map(|c| {
                    let m = h.meal(c.meal_id.as_deref()?)?;
                    (c.day == d && !c.leftover && m.leftovers_for.contains(&slot.id))
                        .then(|| m.id.clone())
                })
            });

            if let Some(id) = leftover {
                cell.meal_id = Some(id);
                cell.leftover = true;
            } else {
                cell.meal_id = pick(h, &plan, day, &slot.id, &mut rng);
            }
            plan.cells.push(cell);
        }
    }
    plan
}

fn pick(
    h: &Household,
    plan: &Plan,
    day: u8,
    slot_id: &str,
    rng: &mut ChaCha8Rng,
) -> Option<String> {
    let fresh_day = h.rules.fresh_days.contains(&(day % 7)) && slot_id == h.rules.main_slot_id;
    let uses = |id: &str| {
        plan.cells
            .iter()
            .filter(|c| c.meal_id.as_deref() == Some(id))
            .count() as f64
    };
    h.meals
        .iter()
        .filter(|m| m.slots.iter().any(|s| s == slot_id))
        .map(|m| {
            let w = warnings(h, plan, day, slot_id, m).len() as f64;
            let mut score = w * 100.0 + uses(&m.id) * 3.0 + rng.random::<f64>() * 5.0;
            if m.fun {
                score += 4.0; // treats are occasional, not the default
            }
            if m.rescue && m.prep == Prep::Instant {
                score += 6.0; // keep rescue meals for emergencies
            }
            if fresh_day && m.prep == Prep::Fresh {
                score -= 10.0; // use the cook-fresh day for fresh cooking
            }
            (score, m)
        })
        // Leave the cell empty rather than plant a meal that breaks the rules.
        .filter(|(score, _)| *score < 100.0)
        .min_by(|a, b| a.0.total_cmp(&b.0))
        .map(|(_, m)| m.id.clone())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_support::household;

    #[test]
    fn fills_sunday_through_friday_lunch_only() {
        let h = household();
        let plan = generate(&h, &Plan::default(), 1);
        assert!(plan.cells.iter().all(|c| c.day % 7 != 6));
        assert!(plan.cell(5, "main").is_none(), "no main meal on Friday");
        assert!(plan.cell(5, "lunch").is_some(), "Friday lunch is planned");
    }

    #[test]
    fn fresh_meals_only_on_fresh_days() {
        let h = household();
        for seed in 0..20 {
            let plan = generate(&h, &Plan::default(), seed);
            for c in plan.cells.iter().filter(|c| c.slot_id == "main") {
                if let Some(m) = c.meal_id.as_deref().and_then(|id| h.meal(id)) {
                    if m.prep == Prep::Fresh {
                        assert_eq!(c.day % 7, 2, "fresh meal on day {}", c.day);
                    }
                }
            }
        }
    }

    #[test]
    fn mains_do_not_repeat_within_two_weeks() {
        let h = household();
        for seed in 0..20 {
            let plan = generate(&h, &Plan::default(), seed);
            let mains: Vec<_> = plan
                .cells
                .iter()
                .filter(|c| c.slot_id == "main")
                .filter_map(|c| c.meal_id.clone())
                .collect();
            let mut dedup = mains.clone();
            dedup.sort();
            dedup.dedup();
            assert_eq!(mains.len(), dedup.len(), "seed {seed}: {mains:?}");
        }
    }

    #[test]
    fn never_plans_a_kashrut_conflict() {
        let h = household();
        for seed in 0..20 {
            let plan = generate(&h, &Plan::default(), seed);
            for day in 0..CYCLE_DAYS {
                assert!(
                    day_conflicts(&h, &plan, day, None).is_empty(),
                    "seed {seed} day {day}"
                );
            }
        }
    }

    #[test]
    fn locked_cells_survive_regeneration() {
        let h = household();
        let locked = Plan {
            cells: vec![Cell {
                day: 3,
                slot_id: "main".into(),
                meal_id: Some("soup".into()),
                locked: true,
                ..Default::default()
            }],
        };
        let plan = generate(&h, &locked, 7);
        assert_eq!(
            plan.cell(3, "main").unwrap().meal_id.as_deref(),
            Some("soup")
        );
    }

    #[test]
    fn cook_double_fills_next_day_lunch_with_leftovers() {
        let h = household();
        let plan = generate(&h, &Plan::default(), 3);
        for c in plan.cells.iter().filter(|c| c.slot_id == "main") {
            if c.meal_id.as_deref() == Some("chicken") && c.day % 7 < 5 {
                let next = plan.cell(c.day + 1, "lunch").unwrap();
                assert!(next.leftover);
                assert_eq!(next.meal_id.as_deref(), Some("chicken"));
            }
        }
    }

    #[test]
    fn options_put_good_fits_first() {
        let h = household();
        let plan = generate(&h, &Plan::default(), 1);
        let opts = options(&h, &plan, 0, "main");
        let first_bad = opts
            .iter()
            .position(|o| !o.warnings.is_empty())
            .unwrap_or(opts.len());
        assert!(opts[first_bad..].iter().all(|o| !o.warnings.is_empty()));
    }
}
