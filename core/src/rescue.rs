//! "Rescue me": narrow the user's pre-entered rescue meals with quick yes/no questions.

use serde::{Deserialize, Serialize};
use tsify::Tsify;

use crate::kashrut::day_conflicts;
use crate::model::{Household, Kashrut, Plan};
use crate::planner::MealOption;

#[derive(Debug, Clone, Serialize, Deserialize, Tsify)]
#[serde(rename_all = "camelCase")]
pub struct RescueAnswer {
    pub question: String,
    pub yes: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Tsify)]
#[serde(rename_all = "camelCase")]
pub struct RescueQuery {
    pub day: u8,
    pub slot_id: String,
    /// Meat, dairy or parve if she picked one; None means either.
    #[serde(default)]
    #[tsify(optional)]
    pub kashrut: Option<Kashrut>,
    #[serde(default)]
    #[tsify(optional)]
    pub answers: Vec<RescueAnswer>,
}

#[derive(Debug, Clone, Serialize, Tsify)]
#[serde(rename_all = "camelCase")]
pub struct RescueResult {
    /// The next question worth asking, if any meal still depends on one.
    pub next_question: Option<String>,
    /// Rescue meals still possible, ready ones (every question answered yes) first.
    pub options: Vec<MealOption>,
    /// How many of `options` are confirmed ready.
    pub ready: usize,
}

pub fn rescue(h: &Household, plan: &Plan, q: &RescueQuery) -> RescueResult {
    let answer = |question: &str| {
        q.answers
            .iter()
            .find(|a| a.question == question)
            .map(|a| a.yes)
    };

    let candidates: Vec<_> = h
        .meals
        .iter()
        .filter(|m| m.rescue && m.slots.contains(&q.slot_id))
        .filter(|m| q.kashrut.is_none_or(|k| m.kashrut == k))
        .filter(|m| {
            m.rescue_questions
                .iter()
                .all(|qq| answer(qq) != Some(false))
        })
        .collect();

    // Ask the question that matters to the most remaining meals first.
    let mut counts: Vec<(&str, usize)> = Vec::new();
    for m in &candidates {
        for qq in m.rescue_questions.iter().filter(|qq| answer(qq).is_none()) {
            match counts.iter_mut().find(|(k, _)| k == qq) {
                Some((_, n)) => *n += 1,
                None => counts.push((qq, 1)),
            }
        }
    }
    let next_question = counts
        .iter()
        .max_by(|a, b| a.1.cmp(&b.1).then(b.0.cmp(a.0)))
        .map(|(k, _)| k.to_string());

    let mut options: Vec<(bool, MealOption)> = candidates
        .iter()
        .map(|m| {
            let ready = m.rescue_questions.iter().all(|qq| answer(qq) == Some(true));
            let warnings = day_conflicts(h, plan, q.day, Some((&q.slot_id, m.kashrut)))
                .into_iter()
                .filter(|c| c.slot_id == q.slot_id || plan.cell(q.day, &c.slot_id).is_some())
                .map(|c| c.message)
                .collect();
            (
                ready,
                MealOption {
                    meal_id: m.id.clone(),
                    name: m.name.clone(),
                    warnings,
                },
            )
        })
        .collect();
    options.sort_by(|a, b| {
        b.0.cmp(&a.0)
            .then(a.1.warnings.len().cmp(&b.1.warnings.len()))
            .then(a.1.name.cmp(&b.1.name))
    });
    let ready = options.iter().filter(|o| o.0).count();
    RescueResult {
        next_question,
        options: options.into_iter().map(|o| o.1).collect(),
        ready,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_support::household;

    fn query(answers: &[(&str, bool)], kashrut: Option<Kashrut>) -> RescueQuery {
        RescueQuery {
            day: 0,
            slot_id: "light".into(),
            kashrut,
            answers: answers
                .iter()
                .map(|(q, y)| RescueAnswer {
                    question: q.to_string(),
                    yes: *y,
                })
                .collect(),
        }
    }

    #[test]
    fn asks_then_narrows() {
        let h = household();
        let plan = Plan::default();
        let r = rescue(&h, &plan, &query(&[], None));
        // Both questions matter to one meal each; ties go alphabetically so the order is stable.
        assert_eq!(r.next_question.as_deref(), Some("Fries in the freezer?"));
        assert_eq!(r.options.len(), 2);

        let r = rescue(
            &h,
            &plan,
            &query(&[("Hot dogs in the fridge?", false)], None),
        );
        let names: Vec<_> = r.options.iter().map(|o| o.name.as_str()).collect();
        assert_eq!(names, vec!["Fries"]);
    }

    #[test]
    fn ready_meals_come_first_and_kashrut_filters() {
        let h = household();
        let r = rescue(
            &h,
            &Plan::default(),
            &query(
                &[
                    ("Hot dogs in the fridge?", true),
                    ("Fries in the freezer?", true),
                ],
                None,
            ),
        );
        assert_eq!(r.ready, 2);
        assert!(r.next_question.is_none());

        let r = rescue(&h, &Plan::default(), &query(&[], Some(Kashrut::Parve)));
        assert_eq!(r.options.len(), 1);
        assert_eq!(r.options[0].name, "Fries");
    }
}
