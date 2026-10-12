//! Meat-then-dairy waiting-time checks, per eater.

use serde::Serialize;
use tsify::Tsify;

use crate::model::{minutes, Cell, EaterKind, Household, Kashrut, Plan};

#[derive(Debug, Clone, PartialEq, Serialize, Tsify)]
#[serde(rename_all = "camelCase")]
pub struct Conflict {
    pub day: u8,
    pub slot_id: String,
    pub eater: String,
    pub message: String,
}

/// The kashrut a cell actually serves, if anything.
pub fn cell_kashrut(h: &Household, cell: &Cell) -> Option<Kashrut> {
    if cell.special_active {
        if let Some(s) = h.special(cell.day % 7, &cell.slot_id) {
            return Some(s.kashrut);
        }
    }
    cell.meal_id
        .as_deref()
        .and_then(|id| h.meal(id))
        .map(|m| m.kashrut)
}

/// Finds every eater who would have dairy too soon after meat on `day`.
/// `candidate` overrides one slot's kashrut, to test a meal before placing it.
pub fn day_conflicts(
    h: &Household,
    plan: &Plan,
    day: u8,
    candidate: Option<(&str, Kashrut)>,
) -> Vec<Conflict> {
    let mut out = Vec::new();
    for eater in &h.eaters {
        let mut eaten: Vec<(u32, Kashrut, &str)> = Vec::new();
        for slot in &h.slots {
            let time = match eater.kind {
                EaterKind::Adult => slot.adult_time.as_deref(),
                EaterKind::Child => slot.child_time.as_deref(),
            };
            let Some(t) = time.and_then(minutes) else {
                continue;
            };
            let k = match candidate {
                Some((sid, k)) if sid == slot.id => Some(k),
                _ => plan.cell(day, &slot.id).and_then(|c| cell_kashrut(h, c)),
            };
            if let Some(k) = k {
                eaten.push((t, k, slot.id.as_str()));
            }
        }
        eaten.sort_by_key(|e| e.0);
        let wait = (eater.wait_hours * 60.0).round() as u32;
        for (i, &(t_dairy, k, sid)) in eaten.iter().enumerate() {
            if k != Kashrut::Dairy {
                continue;
            }
            let last_meat = eaten[..i].iter().rev().find(|e| e.1 == Kashrut::Meat);
            if let Some(&(t_meat, _, meat_sid)) = last_meat {
                if t_dairy - t_meat < wait {
                    let meat_name = h.slot(meat_sid).map_or(meat_sid, |s| s.name.as_str());
                    out.push(Conflict {
                        day,
                        slot_id: sid.to_string(),
                        eater: eater.name.clone(),
                        message: format!(
                            "{} waits {}h after meat, but {} is meat",
                            eater.name, eater.wait_hours, meat_name
                        ),
                    });
                }
            }
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_support::household;

    fn plan_with(cells: &[(&str, &str)]) -> Plan {
        Plan {
            cells: cells
                .iter()
                .map(|(slot, meal)| Cell {
                    day: 0,
                    slot_id: slot.to_string(),
                    meal_id: Some(meal.to_string()),
                    ..Default::default()
                })
                .collect(),
        }
    }

    #[test]
    fn dairy_light_meal_after_meat_main_flags_only_eaters_who_wait() {
        let h = household();
        // Main at 15:00 for kids is meat; light meal at 17:00 is dairy.
        let plan = plan_with(&[("main", "chicken"), ("light", "pancakes")]);
        let c = day_conflicts(&h, &plan, 0, None);
        let names: Vec<_> = c.iter().map(|c| c.eater.as_str()).collect();
        assert_eq!(names, vec!["Shoshi"]);
    }

    #[test]
    fn parve_light_meal_is_fine() {
        let h = household();
        let plan = plan_with(&[("main", "chicken"), ("light", "omelettes")]);
        assert!(day_conflicts(&h, &plan, 0, None).is_empty());
    }

    #[test]
    fn candidate_overrides_slot() {
        let h = household();
        let plan = plan_with(&[("main", "chicken")]);
        let c = day_conflicts(&h, &plan, 0, Some(("light", Kashrut::Dairy)));
        assert_eq!(c.len(), 1);
    }
}
