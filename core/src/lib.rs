//! Planning logic for the family meal planner.
//!
//! Pure functions over plain data: no storage, no I/O. The wasm bindings below are what the
//! Vue app calls; the same functions can be lifted into a server later.

pub mod kashrut;
pub mod model;
pub mod planner;
pub mod prep;
pub mod rescue;
pub mod shopping;

#[cfg(test)]
mod test_support;

use serde::Serialize;
use tsify::{Ts, Tsify};
use wasm_bindgen::prelude::*;

use model::{Household, Plan};

#[derive(Serialize, Tsify)]
#[serde(rename_all = "camelCase")]
pub struct MealOptions {
    pub options: Vec<planner::MealOption>,
}

#[derive(Serialize, Tsify)]
#[serde(rename_all = "camelCase")]
pub struct DayCheck {
    pub conflicts: Vec<kashrut::Conflict>,
}

/// Fills every unlocked cell of the two-week rotation.
#[wasm_bindgen(js_name = generatePlan)]
pub fn generate_plan(
    household: Ts<Household>,
    previous: Ts<Plan>,
    seed: u32,
) -> Result<Ts<Plan>, JsError> {
    let plan = planner::generate(&household.to_rust()?, &previous.to_rust()?, seed.into());
    Ok(plan.into_ts()?)
}

/// Meals that could fill a cell, best fits first, each with its warnings.
#[wasm_bindgen(js_name = mealOptions)]
pub fn meal_options(
    household: Ts<Household>,
    plan: Ts<Plan>,
    day: u8,
    slot_id: String,
) -> Result<Ts<MealOptions>, JsError> {
    let options = planner::options(&household.to_rust()?, &plan.to_rust()?, day, &slot_id);
    Ok(MealOptions { options }.into_ts()?)
}

/// Kashrut waiting-time problems on one rotation day.
#[wasm_bindgen(js_name = checkDay)]
pub fn check_day(
    household: Ts<Household>,
    plan: Ts<Plan>,
    day: u8,
) -> Result<Ts<DayCheck>, JsError> {
    let conflicts = kashrut::day_conflicts(&household.to_rust()?, &plan.to_rust()?, day, None);
    Ok(DayCheck { conflicts }.into_ts()?)
}

/// Tonight's checklist for rotation day `day`.
#[wasm_bindgen(js_name = prepFor)]
pub fn prep_for(
    household: Ts<Household>,
    plan: Ts<Plan>,
    day: u8,
) -> Result<Ts<prep::PrepList>, JsError> {
    Ok(prep::prep_for(&household.to_rust()?, &plan.to_rust()?, day).into_ts()?)
}

/// Ingredient totals for the whole rotation.
#[wasm_bindgen(js_name = shoppingNeeds)]
pub fn shopping_needs(
    household: Ts<Household>,
    plan: Ts<Plan>,
) -> Result<Ts<shopping::ShoppingNeeds>, JsError> {
    Ok(shopping::needs(&household.to_rust()?, &plan.to_rust()?).into_ts()?)
}

/// The next rescue question and the rescue meals still possible.
#[wasm_bindgen]
pub fn rescue(
    household: Ts<Household>,
    plan: Ts<Plan>,
    query: Ts<rescue::RescueQuery>,
) -> Result<Ts<rescue::RescueResult>, JsError> {
    let result = rescue::rescue(&household.to_rust()?, &plan.to_rust()?, &query.to_rust()?);
    Ok(result.into_ts()?)
}
