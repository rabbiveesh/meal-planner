//! Data model shared with the frontend. Everything is (de)serialized as camelCase JSON.

use serde::{Deserialize, Serialize};
use tsify::Tsify;

/// Number of days in one rotation (two weeks, Sunday to Shabbos twice).
pub const CYCLE_DAYS: u8 = 14;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Tsify)]
#[serde(rename_all = "camelCase")]
pub enum EaterKind {
    Adult,
    Child,
}

#[derive(Debug, Clone, Serialize, Deserialize, Tsify)]
#[serde(rename_all = "camelCase")]
pub struct Eater {
    pub id: String,
    pub name: String,
    pub kind: EaterKind,
    /// Hours this eater waits after meat before dairy.
    #[serde(default)]
    #[tsify(optional)]
    pub wait_hours: f32,
    /// Needs a soft-food option (e.g. a toddler).
    #[serde(default)]
    #[tsify(optional)]
    pub soft_food: bool,
    #[serde(default)]
    #[tsify(optional)]
    pub notes: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Tsify)]
#[serde(rename_all = "camelCase")]
pub enum View {
    Home,
    TakeAlong,
    Breakfast,
}

/// One meal slot in the day, e.g. "Main meal" or "Kids' take-along".
#[derive(Debug, Clone, Serialize, Deserialize, Tsify)]
#[serde(rename_all = "camelCase")]
pub struct SlotDef {
    pub id: String,
    pub name: String,
    pub view: View,
    /// When adults eat this slot, "HH:MM". None means adults don't eat it.
    #[serde(default)]
    #[tsify(optional)]
    pub adult_time: Option<String>,
    /// When children eat this slot, "HH:MM". None means children don't eat it.
    #[serde(default)]
    #[tsify(optional)]
    pub child_time: Option<String>,
    /// Weekdays this slot is planned on (0 = Sunday). E.g. a main meal Sunday to Thursday,
    /// packed lunches Sunday to Friday; leaving out Shabbos keeps it unplanned.
    pub days: Vec<u8>,
    /// The same meal may not repeat in this slot within this many days.
    #[serde(default = "default_repeat")]
    #[tsify(optional)]
    pub min_repeat_days: u8,
    /// Prepared the night before (e.g. packed lunches).
    #[serde(default)]
    #[tsify(optional)]
    pub prep_night_before: bool,
}

fn default_repeat() -> u8 {
    CYCLE_DAYS
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Tsify)]
#[serde(rename_all = "camelCase")]
pub enum Kashrut {
    Meat,
    Dairy,
    Parve,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Tsify)]
#[serde(rename_all = "camelCase")]
pub enum Prep {
    /// Made ahead or hands-off (crockpot, oven from frozen): fine on busy days.
    Ahead,
    /// Needs cooking fresh: only on fresh-cook days.
    Fresh,
    /// No prep at all, ready right away.
    Instant,
}

#[derive(Debug, Clone, Serialize, Deserialize, Tsify)]
#[serde(rename_all = "camelCase")]
pub struct Ingredient {
    pub item: String,
    /// Amount per adult serving.
    #[serde(default)]
    #[tsify(optional)]
    pub per_adult: f32,
    /// Amount per child serving.
    #[serde(default)]
    #[tsify(optional)]
    pub per_child: f32,
    #[serde(default)]
    #[tsify(optional)]
    pub unit: String,
    #[serde(default)]
    #[tsify(optional)]
    pub category: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Tsify)]
#[serde(rename_all = "camelCase")]
pub struct Meal {
    pub id: String,
    pub name: String,
    /// Slot ids this meal can fill.
    pub slots: Vec<String>,
    pub kashrut: Kashrut,
    pub prep: Prep,
    /// Weekdays this meal fits (0 = Sunday). Empty means any day.
    #[serde(default)]
    #[tsify(optional)]
    pub days: Vec<u8>,
    #[serde(default)]
    #[tsify(optional)]
    pub kids_version: String,
    #[serde(default)]
    #[tsify(optional)]
    pub adults_version: String,
    #[serde(default)]
    #[tsify(optional)]
    pub soft_version: String,
    #[serde(default)]
    #[tsify(optional)]
    pub ingredients: Vec<Ingredient>,
    /// Night-before tasks, e.g. "Take the chicken out of the freezer".
    #[serde(default)]
    #[tsify(optional)]
    pub prep_tasks: Vec<String>,
    /// Offered by "Rescue me".
    #[serde(default)]
    #[tsify(optional)]
    pub rescue: bool,
    /// Yes/no questions that must all be "yes" for this rescue meal, e.g. "Hot dogs in the fridge?"
    #[serde(default)]
    #[tsify(optional)]
    pub rescue_questions: Vec<String>,
    /// A once-in-a-while treat: at most one per rotation.
    #[serde(default)]
    #[tsify(optional)]
    pub fun: bool,
    /// Slot ids that eat this meal's leftovers the next day (cook double).
    #[serde(default)]
    #[tsify(optional)]
    pub leftovers_for: Vec<String>,
    #[serde(default)]
    #[tsify(optional)]
    pub notes: String,
}

/// A recurring "maybe" on a given day, e.g. Shabbos leftovers on Sunday or Mom's supper on Wednesday.
/// The planner always schedules a backup meal; the app asks the question and marks the cell active.
#[derive(Debug, Clone, Serialize, Deserialize, Tsify)]
#[serde(rename_all = "camelCase")]
pub struct SpecialDay {
    pub day: u8,
    pub slot_id: String,
    pub label: String,
    pub question: String,
    pub kashrut: Kashrut,
}

/// A meal that is planned every week on the same day, e.g. soup every Sunday night.
/// With several meals the planner takes turns between them.
#[derive(Debug, Clone, Serialize, Deserialize, Tsify)]
#[serde(rename_all = "camelCase")]
pub struct FixedMeal {
    /// Weekday (0 = Sunday).
    pub day: u8,
    pub slot_id: String,
    pub meal_ids: Vec<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, Tsify)]
#[serde(rename_all = "camelCase")]
pub struct Rules {
    /// Weekdays she can cook fresh (0 = Sunday).
    #[serde(default)]
    #[tsify(optional)]
    pub fresh_days: Vec<u8>,
    /// Slot that must be made ahead on non-fresh days.
    #[serde(default)]
    #[tsify(optional)]
    pub main_slot_id: String,
    #[serde(default)]
    #[tsify(optional)]
    pub special_days: Vec<SpecialDay>,
    #[serde(default)]
    #[tsify(optional)]
    pub fixed_meals: Vec<FixedMeal>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, Tsify)]
#[serde(rename_all = "camelCase")]
pub struct Household {
    pub eaters: Vec<Eater>,
    pub slots: Vec<SlotDef>,
    pub meals: Vec<Meal>,
    #[serde(default)]
    #[tsify(optional)]
    pub rules: Rules,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize, Tsify)]
#[serde(rename_all = "camelCase")]
pub struct Cell {
    /// Day in the rotation, 0..14 (0 = Sunday of week A).
    pub day: u8,
    pub slot_id: String,
    #[serde(default)]
    #[tsify(optional)]
    pub meal_id: Option<String>,
    /// Filled with leftovers of this meal from the day before.
    #[serde(default)]
    #[tsify(optional)]
    pub leftover: bool,
    /// The special (e.g. Shabbos leftovers) is happening, so the backup meal is skipped.
    #[serde(default)]
    #[tsify(optional)]
    pub special_active: bool,
    /// Chosen by hand; regeneration keeps it.
    #[serde(default)]
    #[tsify(optional)]
    pub locked: bool,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, Tsify)]
#[serde(rename_all = "camelCase")]
pub struct Plan {
    pub cells: Vec<Cell>,
}

impl Household {
    pub fn meal(&self, id: &str) -> Option<&Meal> {
        self.meals.iter().find(|m| m.id == id)
    }
    pub fn slot(&self, id: &str) -> Option<&SlotDef> {
        self.slots.iter().find(|s| s.id == id)
    }
    pub fn special(&self, weekday: u8, slot_id: &str) -> Option<&SpecialDay> {
        self.rules
            .special_days
            .iter()
            .find(|s| s.day == weekday && s.slot_id == slot_id)
    }
    /// The every-week meal rule for a weekday and slot, if any.
    pub fn fixed(&self, weekday: u8, slot_id: &str) -> Option<&FixedMeal> {
        self.rules
            .fixed_meals
            .iter()
            .find(|f| f.day == weekday && f.slot_id == slot_id)
    }
    /// Whether a slot is planned on a rotation day.
    pub fn slot_on_day(&self, slot: &SlotDef, day: u8) -> bool {
        slot.days.contains(&(day % 7))
    }
    /// How many adults and children eat a slot.
    pub fn headcount(&self, slot: &SlotDef) -> (usize, usize) {
        let count = |k| self.eaters.iter().filter(|e| e.kind == k).count();
        (
            if slot.adult_time.is_some() {
                count(EaterKind::Adult)
            } else {
                0
            },
            if slot.child_time.is_some() {
                count(EaterKind::Child)
            } else {
                0
            },
        )
    }
}

impl Plan {
    pub fn cell(&self, day: u8, slot_id: &str) -> Option<&Cell> {
        self.cells
            .iter()
            .find(|c| c.day == day && c.slot_id == slot_id)
    }
}

/// Parses "HH:MM" into minutes after midnight.
pub fn minutes(time: &str) -> Option<u32> {
    let (h, m) = time.split_once(':')?;
    Some(h.trim().parse::<u32>().ok()? * 60 + m.trim().parse::<u32>().ok()?)
}
