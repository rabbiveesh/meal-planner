//! The app's data in the change log. Each eater, slot, meal, staple, plan cell, answer,
//! note and setting is its own record, so two phones that change different things never
//! clash, and two that change the same thing at once leave a conflict for the user.
//!
//! The app edits its data as a whole (`AppData`); `app_data_edits` turns the difference
//! between two versions into entries, and `fold` replays the log back into `AppData`.

use std::collections::{BTreeMap, BTreeSet};

use serde::{Deserialize, Serialize};
use tsify::Tsify;

use crate::model::{AppData, Cell, Eater, Meal, PantryMark, Rules, SlotDef, StapleItem};
use change_graph::{Change, Edit, Record, RecordEdit, Stamp};

/// The value a record holds. A record is always set as a whole.
#[derive(Tsify, Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(tag = "kind", content = "value", rename_all = "camelCase")]
pub enum Entry {
    Eater(Eater),
    Slot(SlotDef),
    Meal(Meal),
    Staple(StapleItem),
    Cell(Cell),
    Rules(Rules),
    /// The answer to a special-day question on one date (`yyyy-MM-dd|slotId`).
    Answer(DatedAnswer),
    /// Her note on one date's meal (`yyyy-MM-dd|slotId`).
    Note(DatedNote),
    /// A pantry-check answer for one shopping item.
    Mark(ItemMark),
    /// A shopping item ticked off in the store, by its key.
    Bought(String),
    RotationStart(String),
    UserName(String),
    TomorrowFrom(String),
    /// The order she arranged a list in. Only written when she moves things around: new
    /// things go after the others, in the order they were added.
    Order(ListOrder),
}

#[derive(Tsify, Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DatedAnswer {
    pub key: String,
    pub yes: bool,
}

#[derive(Tsify, Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DatedNote {
    pub key: String,
    pub text: String,
}

#[derive(Tsify, Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ItemMark {
    pub key: String,
    pub mark: PantryMark,
}

/// The lists whose order she sees and can change.
#[derive(Tsify, Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "camelCase")]
pub enum List {
    Eaters,
    Slots,
    Meals,
    Staples,
}

#[derive(Tsify, Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ListOrder {
    pub list: List,
    pub ids: Vec<String>,
}

impl List {
    fn name(self) -> &'static str {
        match self {
            List::Eaters => "eaters",
            List::Slots => "slots",
            List::Meals => "meals",
            List::Staples => "staples",
        }
    }
}

impl Entry {
    /// The record this entry is kept under, worked out from the entry itself.
    pub fn record_id(&self) -> String {
        match self {
            Entry::Eater(e) => format!("eater/{}", e.id),
            Entry::Slot(s) => format!("slot/{}", s.id),
            Entry::Meal(m) => format!("meal/{}", m.id),
            Entry::Staple(s) => format!("staple/{}", s.id),
            Entry::Cell(c) => format!("cell/{}/{}", c.day, c.slot_id),
            Entry::Rules(_) => "rules".to_string(),
            Entry::Answer(a) => format!("answer/{}", a.key),
            Entry::Note(n) => format!("note/{}", n.key),
            Entry::Mark(m) => format!("mark/{}", m.key),
            Entry::Bought(key) => format!("bought/{key}"),
            Entry::RotationStart(_) => "rotationStart".to_string(),
            Entry::UserName(_) => "userName".to_string(),
            Entry::TomorrowFrom(_) => "tomorrowFrom".to_string(),
            Entry::Order(o) => format!("order/{}", o.list.name()),
        }
    }
}

/// A change to the app's data, as the app and storage see it.
#[derive(Tsify, Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(transparent)]
pub struct EntryChange(pub Change<Entry>);

/// One edit to one record: set its entry, or delete (or restore) it.
#[derive(Tsify, Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(transparent)]
pub struct EntryEdit(pub RecordEdit<Entry>);

/// A record as the log has it so far: the latest entry set.
#[derive(Default)]
struct Latest(Option<Entry>);

impl Record for Latest {
    type Edit = Entry;
    type Field = ();

    fn field(_: &Entry) {}

    fn apply(&mut self, entry: &Entry) {
        self.0 = Some(entry.clone());
    }
}

/// Something the user has to settle because two phones disagreed.
#[derive(Tsify, Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum EditConflict {
    /// The same thing was changed on two phones at once; `options` are the competing
    /// changes, newest first. The app shows the first until she picks.
    #[serde(rename_all = "camelCase")]
    Changed {
        record_id: String,
        options: Vec<EntryChange>,
    },
    /// One phone deleted it while another was still changing (or restoring) it. It stays
    /// until she decides.
    #[serde(rename_all = "camelCase")]
    DeletedWhileChanged {
        record_id: String,
        entry: Box<Entry>,
    },
}

/// The app's data as the change log says it is now, and what waits for the user.
#[derive(Tsify, Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
// The maps in its `AppData` cross into JavaScript as plain objects. Serializing takes this
// setting from the outermost type only, so it is needed here as well as on `AppData`.
#[tsify(hashmap_as_object)]
pub struct Ledger {
    pub data: AppData,
    pub conflicts: Vec<EditConflict>,
}

/// Every record in `data` with its record id, in the order `data` holds them. Lists also
/// give their order.
fn entries(data: &AppData) -> Vec<(String, Entry)> {
    let h = &data.household;
    let ids = |ids: Vec<&String>| ids.into_iter().cloned().collect();
    let orders = [
        (List::Eaters, ids(h.eaters.iter().map(|e| &e.id).collect())),
        (List::Slots, ids(h.slots.iter().map(|s| &s.id).collect())),
        (List::Meals, ids(h.meals.iter().map(|m| &m.id).collect())),
        (
            List::Staples,
            ids(data.shopping.staples.iter().map(|s| &s.id).collect()),
        ),
    ];
    let all = h
        .eaters
        .iter()
        .cloned()
        .map(Entry::Eater)
        .chain(h.slots.iter().cloned().map(Entry::Slot))
        .chain(h.meals.iter().cloned().map(Entry::Meal))
        .chain(data.shopping.staples.iter().cloned().map(Entry::Staple))
        .chain(data.plan.cells.iter().cloned().map(Entry::Cell))
        .chain([Entry::Rules(h.rules.clone())])
        .chain(data.special_answers.iter().map(|(key, yes)| {
            Entry::Answer(DatedAnswer {
                key: key.clone(),
                yes: *yes,
            })
        }))
        .chain(data.notes.iter().map(|(key, text)| {
            Entry::Note(DatedNote {
                key: key.clone(),
                text: text.clone(),
            })
        }))
        .chain(data.shopping.marks.iter().map(|(key, mark)| {
            Entry::Mark(ItemMark {
                key: key.clone(),
                mark: *mark,
            })
        }))
        .chain(data.shopping.bought.iter().cloned().map(Entry::Bought))
        .chain([
            Entry::RotationStart(data.rotation_start.clone()),
            Entry::UserName(data.user_name.clone()),
            Entry::TomorrowFrom(data.tomorrow_from.clone()),
        ])
        .chain(
            orders
                .into_iter()
                .map(|(list, ids)| Entry::Order(ListOrder { list, ids })),
        );
    all.map(|e| (e.record_id(), e)).collect()
}

/// The ids in `ids` that are also in `others`, in the order of `ids`.
fn common<'a>(ids: &'a [String], others: &[String]) -> Vec<&'a String> {
    ids.iter().filter(|id| others.contains(id)).collect()
}

/// The edits that turn `before` into `after`. `changes` is the log so far, which says
/// whether a record that comes back was deleted before.
pub fn app_data_edits(
    changes: &[Change<Entry>],
    before: &AppData,
    after: &AppData,
) -> Vec<RecordEdit<Entry>> {
    let before: BTreeMap<String, Entry> = entries(before).into_iter().collect();
    let after = entries(after);
    let in_after: BTreeSet<&str> = after.iter().map(|(id, _)| id.as_str()).collect();
    let known: BTreeSet<&str> = changes.iter().map(|c| c.record_id.as_str()).collect();
    let mut edits = Vec::new();
    let mut edit = |record_id: &String, edit| {
        edits.push(RecordEdit {
            record_id: record_id.clone(),
            edit,
        })
    };
    for (id, entry) in &after {
        let changed = match (before.get(id), entry) {
            // An order is only news when things she already had were moved around.
            (Some(Entry::Order(old)), Entry::Order(new)) => {
                common(&old.ids, &new.ids) != common(&new.ids, &old.ids)
            }
            (old, new) => old != Some(new),
        };
        if !changed {
            continue;
        }
        if !before.contains_key(id) && known.contains(id.as_str()) {
            edit(id, Edit::Deleted(false));
        }
        edit(id, Edit::Set(entry.clone()));
    }
    for id in before.keys().filter(|id| !in_after.contains(id.as_str())) {
        edit(id, Edit::Deleted(true));
    }
    edits
}

/// The changes that record `edits`, building on every change seen so far.
pub fn record_edits(
    changes: &[Change<Entry>],
    edits: Vec<RecordEdit<Entry>>,
    stamp: &Stamp,
) -> Vec<Change<Entry>> {
    change_graph::record_all(changes, edits, stamp)
}

/// Replays the log into the app's data and the conflicts waiting for the user. `start` is
/// the data before any change: the settings a new household starts with. Its lists are not
/// used: lists hold only what the log holds.
pub fn fold(changes: &[Change<Entry>], start: AppData) -> Ledger {
    // Where each record first appeared, which orders lists she never rearranged.
    let mut first_seen: BTreeMap<&str, (f64, &str)> = BTreeMap::new();
    for c in changes {
        let seen = first_seen
            .entry(&c.record_id)
            .or_insert((c.at, c.id.as_str()));
        if (c.at, c.id.as_str()) < *seen {
            *seen = (c.at, c.id.as_str());
        }
    }

    let mut data = start;
    let mut conflicts = Vec::new();
    let mut orders: BTreeMap<List, Vec<String>> = BTreeMap::new();
    let mut eaters = Vec::new();
    let mut slots = Vec::new();
    let mut meals = Vec::new();
    let mut staples = Vec::new();
    for merged in change_graph::merge::<Latest>(changes) {
        let Some(entry) = merged.record.0 else {
            continue;
        };
        let mut keep_or_delete = merged.deleted_while_edited;
        for options in merged.clashes {
            if options.iter().any(|c| matches!(c.edit, Edit::Deleted(_))) {
                // Deleted on one phone, restored on another: the same keep-or-delete call.
                keep_or_delete = true;
            } else {
                conflicts.push(EditConflict::Changed {
                    record_id: merged.id.clone(),
                    options: options.into_iter().map(EntryChange).collect(),
                });
            }
        }
        if keep_or_delete {
            conflicts.push(EditConflict::DeletedWhileChanged {
                record_id: merged.id.clone(),
                entry: Box::new(entry.clone()),
            });
        }
        if merged.deleted && !keep_or_delete {
            continue;
        }
        let id = merged.id;
        match entry {
            Entry::Eater(e) => eaters.push((id, e)),
            Entry::Slot(s) => slots.push((id, s)),
            Entry::Meal(m) => meals.push((id, m)),
            Entry::Staple(s) => staples.push((id, s)),
            Entry::Cell(c) => data.plan.cells.push(c),
            Entry::Rules(r) => data.household.rules = r,
            Entry::Answer(a) => {
                data.special_answers.insert(a.key, a.yes);
            }
            Entry::Note(n) => {
                data.notes.insert(n.key, n.text);
            }
            Entry::Mark(m) => {
                data.shopping.marks.insert(m.key, m.mark);
            }
            Entry::Bought(key) => data.shopping.bought.push(key),
            Entry::RotationStart(s) => data.rotation_start = s,
            Entry::UserName(s) => data.user_name = s,
            Entry::TomorrowFrom(s) => data.tomorrow_from = s,
            Entry::Order(o) => {
                orders.insert(o.list, o.ids);
            }
        }
    }

    let h = &mut data.household;
    h.eaters = arrange(eaters, orders.get(&List::Eaters), &first_seen);
    h.slots = arrange(slots, orders.get(&List::Slots), &first_seen);
    h.meals = arrange(meals, orders.get(&List::Meals), &first_seen);
    data.shopping.staples = arrange(staples, orders.get(&List::Staples), &first_seen);
    data.plan
        .cells
        .sort_by(|a, b| (a.day, &a.slot_id).cmp(&(b.day, &b.slot_id)));
    data.shopping.bought.sort();
    Ledger { data, conflicts }
}

/// Something she keeps in a list, by its own id.
trait Listed {
    fn id(&self) -> &str;
}

impl Listed for Eater {
    fn id(&self) -> &str {
        &self.id
    }
}

impl Listed for SlotDef {
    fn id(&self) -> &str {
        &self.id
    }
}

impl Listed for Meal {
    fn id(&self) -> &str {
        &self.id
    }
}

impl Listed for StapleItem {
    fn id(&self) -> &str {
        &self.id
    }
}

/// Puts a list's records in the order she arranged them, and anything she added since
/// after them, in the order it was added.
fn arrange<T: Listed>(
    mut items: Vec<(String, T)>,
    order: Option<&Vec<String>>,
    first_seen: &BTreeMap<&str, (f64, &str)>,
) -> Vec<T> {
    let key = |(record_id, item): &(String, T)| {
        let position = order
            .and_then(|ids| ids.iter().position(|id| id == item.id()))
            .unwrap_or(usize::MAX);
        let (at, change) = first_seen
            .get(record_id.as_str())
            .copied()
            .unwrap_or_default();
        (position, at, change)
    };
    items.sort_by(|a, b| {
        let (a, b) = (key(a), key(b));
        a.0.cmp(&b.0)
            .then(a.1.total_cmp(&b.1))
            .then_with(|| a.2.cmp(b.2))
    });
    items.into_iter().map(|(_, item)| item).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::{Cell, ShoppingState};
    use crate::test_support::household;

    fn stamp(device: &str, at: f64) -> Stamp {
        Stamp {
            at,
            device: device.to_string(),
        }
    }

    fn start() -> AppData {
        AppData {
            version: 5,
            rotation_start: "2026-11-15".into(),
            tomorrow_from: "20:00".into(),
            ..AppData::default()
        }
    }

    /// A household with meals, a planned cell, answers and a shopping trip under way.
    fn kitchen() -> AppData {
        let mut data = start();
        data.household = household();
        data.plan.cells.push(Cell {
            day: 0,
            slot_id: data.household.slots[0].id.clone(),
            meal_id: Some(data.household.meals[0].id.clone()),
            locked: true,
            ..Cell::default()
        });
        data.special_answers.insert("2026-11-15|main".into(), true);
        data.notes
            .insert("2026-11-16|main".into(), "plus soup".into());
        data.shopping = ShoppingState {
            staples: vec![StapleItem {
                id: "milk".into(),
                name: "Milk".into(),
                category: "Dairy".into(),
            }],
            marks: [("milk".to_string(), PantryMark::Need)].into(),
            bought: vec!["milk".into()],
        };
        data.user_name = "the user".into();
        data
    }

    /// What a phone that had seen `seen` records when it saves `after` over `before`.
    fn saved_on(
        seen: &[Change<Entry>],
        before: &AppData,
        after: &AppData,
        device: &str,
        at: f64,
    ) -> Vec<Change<Entry>> {
        record_edits(
            seen,
            app_data_edits(seen, before, after),
            &stamp(device, at),
        )
    }

    /// The log after one phone saved `after` on top of all of `log`.
    fn save(
        log: &[Change<Entry>],
        before: &AppData,
        after: &AppData,
        device: &str,
        at: f64,
    ) -> Vec<Change<Entry>> {
        let edits = app_data_edits(log, before, after);
        let mut log = log.to_vec();
        log.extend(record_edits(&log, edits, &stamp(device, at)));
        log
    }

    fn data(log: &[Change<Entry>]) -> AppData {
        fold(log, start()).data
    }

    #[test]
    fn everything_she_had_saved_comes_back_from_the_log() {
        let log = save(&[], &start(), &kitchen(), "phone", 1.0);
        let ledger = fold(&log, start());
        assert_eq!(ledger.data, kitchen());
        assert!(ledger.conflicts.is_empty());
    }

    #[test]
    fn saving_without_changing_anything_adds_nothing() {
        let log = save(&[], &start(), &kitchen(), "phone", 1.0);
        assert!(app_data_edits(&log, &kitchen(), &data(&log)).is_empty());
    }

    #[test]
    fn changes_to_different_meals_on_two_phones_both_stay() {
        let log = save(&[], &start(), &kitchen(), "phone", 1.0);
        let seen = data(&log);
        let mut on_phone = seen.clone();
        on_phone.household.meals[0].name = "Changed on the phone".into();
        let mut on_tablet = seen.clone();
        on_tablet.household.meals[1].name = "Changed on the tablet".into();

        let seen_log = log.clone();
        let mut log = save(&log, &seen, &on_phone, "phone", 2.0);
        log.extend(saved_on(&seen_log, &seen, &on_tablet, "tablet", 3.0));
        let ledger = fold(&log, start());
        assert_eq!(ledger.data.household.meals[0].name, "Changed on the phone");
        assert_eq!(ledger.data.household.meals[1].name, "Changed on the tablet");
        assert!(ledger.conflicts.is_empty());
    }

    #[test]
    fn the_same_meal_changed_on_two_phones_asks_which_to_keep() {
        let log = save(&[], &start(), &kitchen(), "phone", 1.0);
        let seen = data(&log);
        let mut on_phone = seen.clone();
        on_phone.household.meals[0].name = "Phone".into();
        let mut on_tablet = seen.clone();
        on_tablet.household.meals[0].name = "Tablet".into();

        let seen_log = log.clone();
        let mut log = save(&log, &seen, &on_phone, "phone", 2.0);
        log.extend(saved_on(&seen_log, &seen, &on_tablet, "tablet", 3.0));
        let ledger = fold(&log, start());
        // The newest shows until she picks.
        assert_eq!(ledger.data.household.meals[0].name, "Tablet");
        let [EditConflict::Changed { options, .. }] = ledger.conflicts.as_slice() else {
            panic!("expected one conflict, got {:?}", ledger.conflicts);
        };
        assert_eq!(options.len(), 2);

        // Picking the phone's version settles it.
        let pick = RecordEdit {
            record_id: options[1].0.record_id.clone(),
            edit: options[1].0.edit.clone(),
        };
        let mut log = log.clone();
        log.extend(record_edits(&log, vec![pick], &stamp("tablet", 4.0)));
        let ledger = fold(&log, start());
        assert_eq!(ledger.data.household.meals[0].name, "Phone");
        assert!(ledger.conflicts.is_empty());
    }

    #[test]
    fn a_meal_deleted_while_changed_elsewhere_stays_until_she_decides() {
        let log = save(&[], &start(), &kitchen(), "phone", 1.0);
        let seen = data(&log);
        let gone = seen.household.meals[0].id.clone();
        let mut on_phone = seen.clone();
        on_phone.household.meals.remove(0);
        let mut on_tablet = seen.clone();
        on_tablet.household.meals[0].name = "Still wanted".into();

        let seen_log = log.clone();
        let mut log = save(&log, &seen, &on_phone, "phone", 2.0);
        log.extend(saved_on(&seen_log, &seen, &on_tablet, "tablet", 3.0));
        let ledger = fold(&log, start());
        assert!(ledger.data.household.meals.iter().any(|m| m.id == gone));
        assert!(matches!(
            ledger.conflicts.as_slice(),
            [EditConflict::DeletedWhileChanged { .. }]
        ));
    }

    #[test]
    fn something_removed_and_added_again_comes_back() {
        let log = save(&[], &start(), &kitchen(), "phone", 1.0);
        let ticked = data(&log);
        let mut unticked = ticked.clone();
        unticked.shopping.bought.clear();
        let log = save(&log, &ticked, &unticked, "phone", 2.0);
        assert!(data(&log).shopping.bought.is_empty());
        let log = save(&log, &unticked, &ticked, "phone", 3.0);
        assert_eq!(data(&log).shopping.bought, vec!["milk".to_string()]);
    }

    #[test]
    fn meals_keep_the_order_she_put_them_in() {
        let log = save(&[], &start(), &kitchen(), "phone", 1.0);
        let before = data(&log);
        let mut moved = before.clone();
        moved.household.meals.reverse();
        let log = save(&log, &before, &moved, "phone", 2.0);
        assert_eq!(data(&log).household.meals, moved.household.meals);
    }

    #[test]
    fn meals_added_on_two_phones_at_once_both_go_at_the_end() {
        let log = save(&[], &start(), &kitchen(), "phone", 1.0);
        let seen = data(&log);
        let mut new_meal = seen.household.meals[0].clone();
        let mut on_phone = seen.clone();
        new_meal.id = "from-phone".into();
        on_phone.household.meals.push(new_meal.clone());
        let mut on_tablet = seen.clone();
        new_meal.id = "from-tablet".into();
        on_tablet.household.meals.push(new_meal);

        let seen_log = log.clone();
        let mut log = save(&log, &seen, &on_phone, "phone", 2.0);
        log.extend(saved_on(&seen_log, &seen, &on_tablet, "tablet", 3.0));
        let ledger = fold(&log, start());
        let ids: Vec<&str> = ledger
            .data
            .household
            .meals
            .iter()
            .map(|m| m.id.as_str())
            .collect();
        assert_eq!(ids[ids.len() - 2..], ["from-phone", "from-tablet"]);
        assert!(ledger.conflicts.is_empty());
    }
}
