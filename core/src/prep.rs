//! The nightly "prep for tomorrow" checklist.

use serde::Serialize;
use tsify::Tsify;

use crate::model::{Household, Plan, Prep};

#[derive(Debug, Clone, PartialEq, Serialize, Tsify)]
#[serde(rename_all = "camelCase")]
pub struct PrepItem {
    pub text: String,
    pub slot_id: String,
    pub meal_id: String,
}

#[derive(Debug, Clone, Serialize, Tsify)]
#[serde(rename_all = "camelCase")]
pub struct PrepList {
    pub day: u8,
    pub items: Vec<PrepItem>,
}

/// What to do tonight so that rotation day `day` runs smoothly.
pub fn prep_for(h: &Household, plan: &Plan, day: u8) -> PrepList {
    let mut items = Vec::new();
    for slot in &h.slots {
        let Some(cell) = plan.cell(day, &slot.id) else {
            continue;
        };
        if cell.special_active {
            continue;
        }
        let Some(meal) = cell.meal_id.as_deref().and_then(|id| h.meal(id)) else {
            continue;
        };
        let mut push = |text: String| {
            items.push(PrepItem {
                text,
                slot_id: slot.id.clone(),
                meal_id: meal.id.clone(),
            })
        };

        if cell.leftover {
            push(format!("Pack leftover {} for {}", meal.name, slot.name));
            continue;
        }
        for task in &meal.prep_tasks {
            push(task.clone());
        }
        if slot.prep_night_before {
            push(format!("Prep {}: {}", slot.name, meal.name));
        } else if meal.prep_tasks.is_empty()
            && meal.prep == Prep::Ahead
            && slot.id == h.rules.main_slot_id
        {
            let by = slot
                .child_time
                .as_deref()
                .or(slot.adult_time.as_deref())
                .unwrap_or("mealtime");
            push(format!(
                "Plan when to start {} so it's ready by {by}",
                meal.name
            ));
        }
        if !meal.leftovers_for.is_empty() {
            let names: Vec<_> = meal
                .leftovers_for
                .iter()
                .filter_map(|id| h.slot(id).map(|s| s.name.as_str()))
                .collect();
            push(format!(
                "Make extra {} for tomorrow's {}",
                meal.name,
                names.join(" and ")
            ));
        }
    }
    PrepList { day, items }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::Cell;
    use crate::test_support::household;

    fn cell(day: u8, slot: &str, meal: &str, leftover: bool) -> Cell {
        Cell {
            day,
            slot_id: slot.into(),
            meal_id: Some(meal.into()),
            leftover,
            ..Default::default()
        }
    }

    #[test]
    fn lists_defrost_lunch_prep_and_leftovers() {
        let h = household();
        let plan = Plan {
            cells: vec![
                cell(1, "main", "chicken", false),
                cell(1, "lunch", "salad", false),
                cell(2, "lunch", "chicken", true),
            ],
        };
        let texts: Vec<_> = prep_for(&h, &plan, 1)
            .items
            .into_iter()
            .map(|i| i.text)
            .collect();
        assert!(texts.contains(&"Take the chicken out of the freezer".to_string()));
        assert!(texts.contains(&"Prep Our lunch: Salad".to_string()));
        assert!(texts.contains(&"Make extra Chicken for tomorrow's Our lunch".to_string()));

        let next: Vec<_> = prep_for(&h, &plan, 2)
            .items
            .into_iter()
            .map(|i| i.text)
            .collect();
        assert_eq!(next, vec!["Pack leftover Chicken for Our lunch"]);
    }

    #[test]
    fn skips_cells_covered_by_a_special() {
        let h = household();
        let mut c = cell(0, "main", "chicken", false);
        c.special_active = true;
        assert!(prep_for(&h, &Plan { cells: vec![c] }, 0).items.is_empty());
    }
}
