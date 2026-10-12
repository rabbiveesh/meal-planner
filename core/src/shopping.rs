//! Ingredient totals for the rotation, for the two-week shop.

use std::collections::BTreeMap;

use serde::Serialize;
use tsify::Tsify;

use crate::model::{Household, Plan};

#[derive(Debug, Clone, PartialEq, Serialize, Tsify)]
#[serde(rename_all = "camelCase")]
pub struct NeedItem {
    pub item: String,
    pub unit: String,
    pub category: String,
    /// Total amount in `unit`.
    pub quantity: f32,
    /// Adult servings that use this ingredient.
    pub adult_servings: u32,
    /// Child servings that use this ingredient.
    pub child_servings: u32,
    /// Names of the meals that need it.
    pub meals: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Tsify)]
#[serde(rename_all = "camelCase")]
pub struct ShoppingNeeds {
    pub items: Vec<NeedItem>,
}

/// Sums every ingredient the rotation cooks. Leftover cells add servings to the
/// meal that produced them; cells covered by a special (e.g. Mom's supper) cook nothing.
pub fn needs(h: &Household, plan: &Plan) -> ShoppingNeeds {
    let mut totals: BTreeMap<(String, String, String), NeedItem> = BTreeMap::new();

    for cell in plan
        .cells
        .iter()
        .filter(|c| !c.leftover && !c.special_active)
    {
        let Some(meal) = cell.meal_id.as_deref().and_then(|id| h.meal(id)) else {
            continue;
        };
        let Some(slot) = h.slot(&cell.slot_id) else {
            continue;
        };
        let (mut adults, mut children) = h.headcount(slot);
        for lo in plan.cells.iter().filter(|c| {
            c.leftover && c.day == cell.day + 1 && c.meal_id.as_deref() == Some(&meal.id)
        }) {
            if let Some(s) = h.slot(&lo.slot_id) {
                let (a, c) = h.headcount(s);
                adults += a;
                children += c;
            }
        }

        for ing in &meal.ingredients {
            let key = (
                ing.category.clone(),
                ing.item.trim().to_lowercase(),
                ing.unit.clone(),
            );
            let entry = totals.entry(key).or_insert_with(|| NeedItem {
                item: ing.item.trim().to_string(),
                unit: ing.unit.clone(),
                category: ing.category.clone(),
                quantity: 0.0,
                adult_servings: 0,
                child_servings: 0,
                meals: Vec::new(),
            });
            entry.quantity += ing.per_adult * adults as f32 + ing.per_child * children as f32;
            if ing.per_adult > 0.0 {
                entry.adult_servings += adults as u32;
            }
            if ing.per_child > 0.0 {
                entry.child_servings += children as u32;
            }
            if !entry.meals.contains(&meal.name) {
                entry.meals.push(meal.name.clone());
            }
        }
    }
    ShoppingNeeds {
        items: totals.into_values().collect(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::Cell;
    use crate::test_support::household;

    #[test]
    fn counts_servings_including_tomorrows_leftovers() {
        let h = household();
        let plan = Plan {
            cells: vec![
                Cell {
                    day: 0,
                    slot_id: "main".into(),
                    meal_id: Some("chicken".into()),
                    ..Default::default()
                },
                Cell {
                    day: 1,
                    slot_id: "lunch".into(),
                    meal_id: Some("chicken".into()),
                    leftover: true,
                    ..Default::default()
                },
                Cell {
                    day: 7,
                    slot_id: "main".into(),
                    meal_id: Some("chicken".into()),
                    special_active: true,
                    ..Default::default()
                },
            ],
        };
        let n = needs(&h, &plan);
        assert_eq!(n.items.len(), 1);
        let chicken = &n.items[0];
        // Main: 1 adult + 2 kids; leftover lunch: 1 more adult. Day 7 is covered by a special.
        assert_eq!(chicken.adult_servings, 2);
        assert_eq!(chicken.child_servings, 2);
        assert_eq!(chicken.quantity, 2.0 * 0.25 + 2.0 * 0.15);
    }
}
