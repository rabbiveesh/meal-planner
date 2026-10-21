//! A small household used by the unit tests.

use crate::model::*;

fn eater(id: &str, kind: EaterKind, wait_hours: f32) -> Eater {
    Eater {
        id: id.into(),
        name: id.into(),
        kind,
        wait_hours,
        soft_food: false,
        notes: String::new(),
    }
}

fn slot(
    id: &str,
    name: &str,
    view: View,
    adult: Option<&str>,
    child: Option<&str>,
    friday: bool,
) -> SlotDef {
    SlotDef {
        id: id.into(),
        name: name.into(),
        view,
        adult_time: adult.map(Into::into),
        child_time: child.map(Into::into),
        days: if friday {
            vec![0, 1, 2, 3, 4, 5]
        } else {
            vec![0, 1, 2, 3, 4]
        },
        min_repeat_days: CYCLE_DAYS,
        prep_night_before: id == "lunch",
        hand_written: false,
    }
}

fn meal(id: &str, name: &str, slots: &[&str], kashrut: Kashrut, prep: Prep) -> Meal {
    Meal {
        id: id.into(),
        name: name.into(),
        slots: slots.iter().map(|s| s.to_string()).collect(),
        kashrut,
        prep,
        days: vec![],
        kids_version: String::new(),
        adults_version: String::new(),
        soft_version: String::new(),
        ingredients: vec![],
        prep_tasks: vec![],
        rescue: false,
        rescue_questions: vec![],
        fun: false,
        leftovers_for: vec![],
        notes: String::new(),
    }
}

pub fn household() -> Household {
    use Kashrut::*;
    use Prep::*;

    let mut chicken = meal("chicken", "Chicken", &["main"], Meat, Ahead);
    chicken.prep_tasks = vec!["Take the chicken out of the freezer".into()];
    chicken.leftovers_for = vec!["lunch".into()];
    chicken.ingredients = vec![Ingredient {
        item: "Chicken thighs".into(),
        per_adult: 0.25,
        per_child: 0.15,
        unit: "kg".into(),
        category: "Meat".into(),
    }];

    let mut hotdogs = meal("hotdogs", "Hot dogs", &["light"], Meat, Instant);
    hotdogs.rescue = true;
    hotdogs.rescue_questions = vec!["Hot dogs in the fridge?".into()];
    let mut fries = meal("fries", "Fries", &["light"], Parve, Instant);
    fries.rescue = true;
    fries.rescue_questions = vec!["Fries in the freezer?".into()];

    let meals = vec![
        chicken,
        meal("shawarma", "Shawarma chicken", &["main"], Meat, Ahead),
        meal("crockpot", "Crockpot chicken", &["main"], Meat, Ahead),
        meal("soup", "Veg soup", &["main"], Parve, Ahead),
        meal("schnitzel", "Schnitzel", &["main"], Meat, Ahead),
        meal("mujadara", "Mujadara", &["main"], Parve, Fresh),
        meal("pasta", "Pasta", &["main"], Dairy, Ahead),
        meal("burgers", "Burgers", &["main"], Meat, Ahead),
        meal("bake", "Veg bake", &["main"], Parve, Ahead),
        meal("pancakes", "Pancakes", &["light"], Dairy, Fresh),
        meal("omelettes", "Omelettes", &["light"], Parve, Fresh),
        meal("yogurt", "Yogurt bowls", &["light"], Dairy, Instant),
        meal("zaatar", "Zaatar toasts", &["light"], Parve, Fresh),
        meal("sandwich", "Sandwiches", &["takeAlong"], Parve, Instant),
        meal("bagels", "Bagels", &["takeAlong"], Parve, Instant),
        meal("salad", "Salad", &["lunch"], Parve, Ahead),
        meal("hummus", "Hummus bowl", &["lunch"], Parve, Ahead),
        hotdogs,
        fries,
    ];
    Household {
        eaters: vec![
            eater("Mom", EaterKind::Adult, 6.0),
            eater("Shoshi", EaterKind::Child, 3.0),
            eater("Yitzi", EaterKind::Child, 0.0),
        ],
        slots: vec![
            slot(
                "takeAlong",
                "Kids' take-along",
                View::TakeAlong,
                None,
                Some("10:00"),
                true,
            ),
            slot(
                "lunch",
                "Our lunch",
                View::TakeAlong,
                Some("12:30"),
                None,
                true,
            ),
            slot(
                "main",
                "Main meal",
                View::Home,
                Some("19:30"),
                Some("15:00"),
                false,
            ),
            slot(
                "light",
                "Kids' light meal",
                View::Home,
                None,
                Some("17:00"),
                false,
            ),
        ],
        meals,
        rules: Rules {
            fresh_days: vec![2],
            main_slot_id: "main".into(),
            special_days: vec![SpecialDay {
                day: 0,
                slot_id: "main".into(),
                label: "Shabbos leftovers".into(),
                question: "Any Shabbos leftovers for Sunday?".into(),
                kashrut: Kashrut::Meat,
            }],
            fixed_meals: vec![],
        },
    }
}
