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
    // Her every-week rule puts this meal here on purpose, whatever its own settings say.
    let fixed_here = is_fixed(h, weekday, slot_id, &meal.id);
    if !fixed_here && !meal.slots.iter().any(|s| s == slot_id) {
        w.push(format!("Not usually a {}", slot.name));
    }
    if !fixed_here && !meal.days.is_empty() && !meal.days.contains(&weekday) {
        w.push("Not set for this day of the week".into());
    }
    if slot_id == h.rules.main_slot_id
        && meal.prep == Prep::Fresh
        && !h.rules.fresh_days.contains(&weekday)
    {
        w.push("Needs cooking fresh, but this isn't a cook-fresh day".into());
    }
    let repeat = plan.cells.iter().filter(|_| !fixed_here).find(|c| {
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

/// Whether an every-week rule names `meal_id` for this weekday and slot.
fn is_fixed(h: &Household, weekday: u8, slot_id: &str, meal_id: &str) -> bool {
    h.fixed(weekday, slot_id)
        .is_some_and(|f| f.meal_ids.iter().any(|id| id == meal_id))
}

/// All meals that could go in a cell, best fits first. Powers the manual swap list.
/// A hand-written slot has none: she writes it herself.
pub fn options(h: &Household, plan: &Plan, day: u8, slot_id: &str) -> Vec<MealOption> {
    if h.slot(slot_id).is_some_and(|s| s.hand_written) {
        return Vec::new();
    }
    let mut out: Vec<MealOption> = h
        .meals
        .iter()
        .filter(|m| m.slots.iter().any(|s| s == slot_id) || is_fixed(h, day % 7, slot_id, &m.id))
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

/// Fills every unlocked cell of the rotation from her meals for that slot, even when none fits
/// every rule; only a kashrut conflict, or no meals for the slot at all, leaves a cell empty.
/// Locked cells are kept as they are.
/// Every-week meals go in first, so everything else is planned around them.
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
            if !h.planned_on(slot, day) || plan.cell(day, &slot.id).is_some() {
                continue;
            }
            if let Some(id) = pick_fixed(h, &plan, day, &slot.id) {
                plan.cells.push(Cell {
                    day,
                    slot_id: slot.id.clone(),
                    meal_id: Some(id),
                    ..Default::default()
                });
            }
        }
    }

    for day in 0..CYCLE_DAYS {
        for slot in &slots {
            if !h.planned_on(slot, day) || plan.cell(day, &slot.id).is_some() {
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

/// The every-week meal for a cell, taking turns: the one planned least so far, in her order.
fn pick_fixed(h: &Household, plan: &Plan, day: u8, slot_id: &str) -> Option<String> {
    let uses = |id: &str| {
        plan.cells
            .iter()
            .filter(|c| c.meal_id.as_deref() == Some(id))
            .count()
    };
    h.fixed(day % 7, slot_id)?
        .meal_ids
        .iter()
        .filter(|id| h.meal(id).is_some())
        .min_by_key(|id| uses(id))
        .cloned()
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
        // A maybe-day's meal is only served when she says yes, never planned by itself.
        .filter(|m| !h.is_maybe_meal(&m.id))
        // Kashrut is the one rule never broken to fill a cell.
        .filter(|m| day_conflicts(h, plan, day, Some((slot_id, m.kashrut))).is_empty())
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
        // Never leave a cell blank: when nothing fits cleanly, the meal breaking the fewest
        // rules goes in, and the swap list shows her why.
        .min_by(|a, b| a.0.total_cmp(&b.0))
        .map(|(_, m)| m.id.clone())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::FixedMeal;
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
    fn maybe_day_meal_is_never_planned_by_itself() {
        let mut h = household();
        h.rules.special_days[0].meal_id = Some("soup".into());
        for seed in 0..20 {
            let plan = generate(&h, &Plan::default(), seed);
            assert!(
                plan.cells
                    .iter()
                    .all(|c| c.meal_id.as_deref() != Some("soup")),
                "seed {seed}"
            );
        }
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
        // One main for each of the ten main-meal days.
        let mut h = household();
        let mut stew = h.meal("soup").unwrap().clone();
        stew.id = "stew".into();
        h.meals.push(stew);
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
    fn never_leaves_a_cell_blank_when_she_has_meals_for_it() {
        // Nine mains for ten days, six light meals for ten: some repeats are unavoidable.
        let h = household();
        for seed in 0..20 {
            let plan = generate(&h, &Plan::default(), seed);
            for slot in &h.slots {
                for day in (0..CYCLE_DAYS).filter(|&d| h.planned_on(slot, d)) {
                    let c = plan.cell(day, &slot.id).unwrap();
                    let m = c.meal_id.as_deref().and_then(|id| h.meal(id));
                    let m = m.unwrap_or_else(|| panic!("seed {seed}: {} day {day}", slot.id));
                    assert!(
                        c.leftover || m.slots.contains(&slot.id),
                        "only her meals for the slot"
                    );
                }
            }
        }
    }

    #[test]
    fn short_pool_spreads_meals_before_repeating() {
        let h = household();
        let plan = generate(&h, &Plan::default(), 1);
        let mains: Vec<_> = plan
            .cells
            .iter()
            .filter(|c| c.slot_id == "main")
            .filter_map(|c| c.meal_id.clone())
            .collect();
        let mut dedup = mains.clone();
        dedup.sort();
        dedup.dedup();
        assert_eq!(
            dedup.len(),
            9,
            "every main used before one repeats: {mains:?}"
        );
    }

    #[test]
    fn slot_with_no_meals_stays_empty() {
        let mut h = household();
        h.meals
            .retain(|m| !m.slots.contains(&"takeAlong".to_string()));
        let plan = generate(&h, &Plan::default(), 1);
        assert!(plan.cell(0, "takeAlong").unwrap().meal_id.is_none());
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

    fn with_fixed(day: u8, slot_id: &str, meal_ids: &[&str]) -> Household {
        let mut h = household();
        h.rules.fixed_meals.push(FixedMeal {
            day,
            slot_id: slot_id.into(),
            meal_ids: meal_ids.iter().map(|id| id.to_string()).collect(),
        });
        h
    }

    #[test]
    fn every_week_meal_is_planned_on_its_day_both_weeks() {
        let h = with_fixed(1, "main", &["shawarma"]);
        for seed in 0..20 {
            let plan = generate(&h, &Plan::default(), seed);
            for day in [1, 8] {
                let c = plan.cell(day, "main").unwrap();
                assert_eq!(c.meal_id.as_deref(), Some("shawarma"), "seed {seed}");
                assert!(!c.locked, "a rule, not a hand-picked cell");
            }
            let others = plan
                .cells
                .iter()
                .filter(|c| c.meal_id.as_deref() == Some("shawarma") && c.slot_id == "main");
            assert_eq!(others.count(), 2, "seed {seed}: not planned on other days");
        }
    }

    #[test]
    fn every_week_meals_take_turns() {
        let h = with_fixed(0, "main", &["soup", "pasta"]);
        let plan = generate(&h, &Plan::default(), 5);
        assert_eq!(
            plan.cell(0, "main").unwrap().meal_id.as_deref(),
            Some("soup")
        );
        assert_eq!(
            plan.cell(7, "main").unwrap().meal_id.as_deref(),
            Some("pasta")
        );
    }

    #[test]
    fn every_week_meal_has_no_warnings_where_it_is_fixed() {
        // Not a main meal, and repeating every 7 days in a slot that allows 14.
        let h = with_fixed(1, "main", &["salad"]);
        let plan = generate(&h, &Plan::default(), 2);
        assert_eq!(
            plan.cell(1, "main").unwrap().meal_id.as_deref(),
            Some("salad")
        );
        let salad = h.meal("salad").unwrap();
        assert!(warnings(&h, &plan, 8, "main", salad).is_empty());
        assert!(options(&h, &plan, 1, "main")
            .iter()
            .any(|o| o.meal_id == "salad" && o.warnings.is_empty()));
        // Elsewhere it is still a poor fit.
        assert!(!warnings(&h, &plan, 3, "main", salad).is_empty());
    }

    #[test]
    fn every_week_rule_with_deleted_meals_falls_back_to_normal_planning() {
        let h = with_fixed(0, "main", &["gone"]);
        let plan = generate(&h, &Plan::default(), 1);
        assert!(plan.cell(0, "main").unwrap().meal_id.is_some());
    }

    #[test]
    fn locked_cell_beats_every_week_meal() {
        let h = with_fixed(3, "main", &["shawarma"]);
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
        assert_eq!(
            plan.cell(10, "main").unwrap().meal_id.as_deref(),
            Some("shawarma")
        );
    }

    fn with_hand_written(slot_id: &str) -> Household {
        let mut h = household();
        h.slots
            .iter_mut()
            .filter(|s| s.id == slot_id)
            .for_each(|s| s.hand_written = true);
        h
    }

    #[test]
    fn hand_written_slot_is_never_planned() {
        let h = with_hand_written("lunch");
        for seed in 0..20 {
            let plan = generate(&h, &Plan::default(), seed);
            assert!(
                plan.cells.iter().all(|c| c.slot_id != "lunch"),
                "seed {seed}"
            );
            assert!(
                plan.cells.iter().any(|c| c.slot_id == "main"),
                "seed {seed}"
            );
        }
    }

    #[test]
    fn hand_written_slot_stays_empty_even_with_an_every_week_meal() {
        let mut h = with_hand_written("lunch");
        h.rules.fixed_meals.push(FixedMeal {
            day: 1,
            slot_id: "lunch".into(),
            meal_ids: vec!["salad".into()],
        });
        let plan = generate(&h, &Plan::default(), 4);
        assert!(plan.cell(1, "lunch").is_none());
    }

    #[test]
    fn hand_written_slot_has_no_options() {
        let h = with_hand_written("lunch");
        assert!(options(&h, &Plan::default(), 0, "lunch").is_empty());
        assert!(!options(&h, &Plan::default(), 0, "main").is_empty());
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
