/* globals game, FormApplication, console, Dialog, saveDataToFile, ui,
  readTextFromFile, renderTemplate, foundry, canvas, $ */
/* jshint -W089 */

import { get_item_trait } from "./item_card.js";
import { SYSTEM_GLOBAL_ACTION } from "./actions/builtin-actions.js";
import { manage_selectable_gm } from "./gm_modifiers.js";
import { get_roll_options } from "./cards_common.js";
import { SettingsUtils } from "./utils.js";

// DMG override is still not implemented.
/**
 * Registers all the available global actions
 */
export function register_actions() {
  let world_actions = SettingsUtils.getSetting("world_global_actions");
  if (world_actions && world_actions[0] instanceof Array) {
    world_actions = world_actions[0];
  }
  game.brsw.GLOBAL_ACTIONS = SYSTEM_GLOBAL_ACTION;
  for (const world_action of world_actions) {
    if (world_action.replaceExisting) {
      //The action will replace any existing actions in the default list. Filter them out and assign the array
      game.brsw.GLOBAL_ACTIONS = game.brsw.GLOBAL_ACTIONS.filter(a => a.id !== world_action.id);
    }
  }
  game.brsw.GLOBAL_ACTIONS = game.brsw.GLOBAL_ACTIONS.concat(world_actions);
}

/**
 * Adds an array of actions to the available ones. The array should be in the same format as builtin-actions.js.
 * The array is cleared when reloading and should be set again
 * @param {Array} actions
 */
function add_actions(actions) {
  // Delete duplicate actions
  const actions_ids = actions.map((action) => action.id);
  const actions_to_delete = game.brsw.GLOBAL_ACTIONS.filter((action) =>
    actions_ids.includes(action.id),
  );
  game.brsw.GLOBAL_ACTIONS = game.brsw.GLOBAL_ACTIONS.filter(
    (action) => !actions_to_delete.includes(action),
  );
  game.brsw.GLOBAL_ACTIONS = game.brsw.GLOBAL_ACTIONS.concat(actions);
}

/**
 * Process the not selector
 */
function process_not_selector(action, item, actor) {
  return !process_action(action.not_selector[0], item, actor);
}

/**
 * Expose some functions to be used in macros.
 */
export function expose_global_actions_functions() {
  game.brsw.add_actions = add_actions;
  game.brsw.get_roll_options = get_roll_options;
}

/**
 * Process and selector.
 * @param action
 * @param item
 * @param actor
 * @return {boolean}
 */
function process_and_selector(action, item, actor) {
  let selected = true;
  for (let selection_option of action.and_selector) {
    if (!process_action(selection_option, item, actor)) {
      selected = false;
      break;
    }
  }
  return selected;
}

/**
 * Checks if an or selector should be used
 * @param action
 * @param item
 * @param actor
 * @return {boolean}
 */
function process_or_selector(action, item, actor) {
  let selected = false;
  for (let selection_option of action.or_selector) {
    if (process_action(selection_option, item, actor)) {
      selected = true;
      break;
    }
  }
  return selected;
}

/**
 * Check if an action applies to a roll
 * @param action
 * @param item
 * @param actor
 * @return {boolean}
 */
function process_action(action, item, actor) {
  let selected = false;
  if (action.hasOwnProperty("disable_if_module_present")) {
    const module_data = game.modules.get(action.disable_if_module_present);
    selected = !(module_data && module_data.active);
  }
  if (action.hasOwnProperty("selector_type")) {
    selected = check_selector(
      action.selector_type,
      action.selector_value,
      item,
      actor,
    );
  } else if (action.hasOwnProperty("and_selector")) {
    selected = process_and_selector(action, item, actor);
  } else if (action.hasOwnProperty("or_selector")) {
    selected = process_or_selector(action, item, actor);
  } else if (action.hasOwnProperty("not_selector")) {
    selected = process_not_selector(action, item, actor);
  }
  return selected;
}

/**
 * Returns the global actions available for an item
 * @param {Item} item
 * @param {SwadeActor} actor
 */
export function get_actions(item, actor) {
  let actions_avaliable = [];
  let disabled_actions = SettingsUtils.getSetting("system_action_disabled");
  if (disabled_actions && disabled_actions[0] instanceof Array) {
    disabled_actions = disabled_actions[0];
  }
  for (let action of game.brsw.GLOBAL_ACTIONS) {
    if (
      !disabled_actions.includes(action.id) &&
      process_action(action, item, actor)
    ) {
      actions_avaliable.push(action);
    }
  }
  actions_avaliable.sort((a, b) => {
    return a.id < b.id ? -1 : 1;
  });
  return actions_avaliable;
}

// noinspection OverlyComplexFunctionJS,FunctionTooLongJS
/**
 * Check if a selector matches
 * @param type Type of the selector
 * @param value Value of the selector
 * @param item item been checked
 * @param actor actor been checked
 */
function check_selector(type, value, item, actor) {
  let selected = false;
  if (type === "skill") {
    if (item.type === "attribute") {
      selected = false;
    } else {
      const skill = item.type === "skill" ? item : get_item_trait(item, actor);
      if (skill) {
        if (value.slice(0, 5) === "BRSW.") {
          selected = skill.name
            .toLowerCase()
            .includes(game.i18n.localize(value).toLowerCase());
        } else {
          selected =
            skill.name.toLowerCase().includes(value.toLowerCase()) ||
            skill.name
              .toLowerCase()
              .includes(
                game.i18n
                  .localize("BRSW.SkillName-" + value.toLowerCase())
                  .toLowerCase(),
              );
        }
      }
    }
  } else if (type === "attribute") {
    selected =
      item.type === "attribute" &&
      item.name.toLowerCase().includes(value.toLowerCase());
  } else if (type === "all") {
    selected = true;
  } else if (type === "item_type") {
    selected = item.type === value;
  } else if (type === "actor_name") {
    selected = actor.name.toLowerCase().includes(value.toLowerCase());
  } else if (type === "actor_has_skill") {
    const item = actor.items.find((item) => {
      return item.type === 'skill' &&
        item.name.toLowerCase() === game.i18n.localize(value).toLowerCase()
    });
    return !!item;
  } else if (type === "actor_has_item") {
    const ITEM_TYPES = ["skill", "weapon", "armor", "shield", "gear", "consumable"];
    const item = actor.items.find((item) => {
      return (
        ITEM_TYPES.indexOf(item.type) !== -1 &&
        item.name.toLowerCase() === game.i18n.localize(value).toLowerCase()
      );
    });
    return !!item;
  } else if (type === "actor_equips_item") {
    const items = actor.items.find((item) => {
      return (
        item.name.toLowerCase() === game.i18n.localize(value).toLowerCase() &&
        item.system.equipStatus > 1
      );
    });
    return !!items;
  } else if (type === "item_name" && item.type !== "skill") {
    selected = item.name.toLowerCase().includes(value.toLowerCase());
  } else if (type === "item_description_includes") {
    const description = `${item?.system?.description} ${item?.system?.trapping} ${item?.system?.category} ${item?.system?.notes}`;
    selected = description.toLowerCase().includes(value.toLowerCase());
  } else if (type === "actor_has_effect") {
    // noinspection AnonymousFunctionJS
    const effect = actor.appliedEffects.find((effect) =>
      effect.name.toLowerCase().includes(value.toLowerCase()),
    );
    selected = effect ? !effect.disabled : false;
  } else if (type === "actor_has_edge") {
    const edge_name = value.includes("BRSW.EdgeName-")
      ? game.i18n.localize(value)
      : value;
    // noinspection AnonymousFunctionJS
    const edge = actor.items.find((item) => {
      return (
        item.type === "edge" &&
        item.name.toLowerCase().includes(edge_name.toLowerCase())
      );
    });
    selected = !!edge;
  } else if (type === "actor_has_ability") {
    const ability_name = value.includes("BRSW.AbilityName-")
      ? game.i18n.localize(value)
      : value;
    // noinspection AnonymousFunctionJS
    const ability = actor.items.find((item) => {
      return (
        item.type === "ability" &&
        item.name.toLowerCase().includes(ability_name.toLowerCase())
      );
    });
    selected = !!ability;
  } else if (type === "actor_has_hindrance") {
    const hindrance_name = value.includes("BRSW.EdgeName-")
      ? game.i18n.localize(value)
      : value;
    // noinspection AnonymousFunctionJS
    const hindrance = actor.items.find((item) => {
      return (
        item.type === "hindrance" &&
        item.name.toLowerCase().includes(hindrance_name.toLowerCase())
      );
    });
    selected = !!hindrance;
  } else if (type === "actor_has_major_hindrance") {
    const hindrance_name = value.includes("BRSW.EdgeName-")
      ? game.i18n.localize(value)
      : value;
    // noinspection AnonymousFunctionJS
    const hindrance = actor.items.find((item) => {
      return (
        item.type === "hindrance" &&
        item.name.toLowerCase().includes(hindrance_name.toLowerCase()) &&
        item.system?.isMajor
      );
    });
    selected = !!hindrance;
  } else if (type.indexOf("actor_additional_stat_") === 0) {
    const additional_stat = type.slice(22);
    if (actor.system.additionalStats.hasOwnProperty(additional_stat)) {
      // noinspection EqualityComparisonWithCoercionJS
      selected = actor.system.additionalStats[additional_stat].value == value;
    }
  } else if (type.indexOf("item_additional_stat_") === 0) {
    const additional_stat = type.slice(21);
    if (item?.system?.additionalStats.hasOwnProperty(additional_stat)) {
      // noinspection EqualityComparisonWithCoercionJS
      selected = item.system.additionalStats[additional_stat].value == value;
    }
  } else if (type === "actor_has_joker") {
    selected = actor.hasJoker;
  } else if (type === "target_has_edge") {
    const edge_name = value.includes("BRSW.EdgeName-")
      ? game.i18n.localize(value)
      : value;
    for (let targeted_token of game.user.targets) {
      const edge = targeted_token.actor?.items.find((item) => {
        return (
          item.type === "edge" &&
          item.name.toLowerCase().includes(edge_name.toLowerCase())
        );
      });
      selected = selected || !!edge;
    }
  } else if (type === "target_has_hindrance") {
    const hindrance_name = value.includes("BRSW.EdgeName-")
      ? game.i18n.localize(value)
      : value;
    for (let targeted_token of game.user.targets) {
      const hindrance = targeted_token.actor?.items.find((item) => {
        return (
          item.type === "hindrance" &&
          item.name.toLowerCase().includes(hindrance_name.toLowerCase())
        );
      });
      selected = selected || !!hindrance;
    }
  } else if (type === "target_has_major_hindrance") {
    const hindrance_name = value.includes("BRSW.EdgeName-")
      ? game.i18n.localize(value)
      : value;
    // noinspection AnonymousFunctionJS
    for (let targeted_token of game.user.targets) {
      const hindrance = targeted_token.actor?.items.find((item) => {
        return (
          item.type === "hindrance" &&
          item.name.toLowerCase().includes(hindrance_name.toLowerCase()) &&
          item.system?.isMajor
        );
      });
      selected = selected || !!hindrance;
    }
  } else if (type === "target_has_ability") {
    const ability_name = value.includes("BRSW.EdgeName-")
      ? game.i18n.localize(value)
      : value;
    for (let targeted_token of game.user.targets) {
      const ability = targeted_token.actor?.items.find((item) => {
        return (
          item.type === "ability" &&
          item.name.toLowerCase().includes(ability_name.toLowerCase())
        );
      });
      selected = selected || !!ability;
    }
  } else if (type === "target_has_effect") {
    selected = false;
    for (const targeted_token of game.user.targets) {
      const effect = targeted_token.actor?.appliedEffects.find(
        (ef) => ef.name.toLowerCase().includes(value.toLowerCase()), // jshint ignore:line
      );
      if (effect) {
        selected = selected || effect ? !effect.disabled : false;
      }
    }
  } else if (type === "faction") {
    const tokens = actor.getActiveTokens();
    if (
      game.user.targets.size > 0 &&
      tokens.length > 0 &&
      tokens[0] !== game.user.targets.first()
    ) {
      const actor_disposition = tokens[0].document.disposition;
      const target_disposition = game.user.targets.first().document.disposition;
      if (value === "same") {
        selected = actor_disposition === target_disposition;
      } else {
        selected = actor_disposition !== target_disposition;
      }
    } else {
      selected = false;
    }
  } else if (type === "is_wildcard") {
    selected = actor.system.wildcard;
    if (value === "false") {
      selected = !selected;
    }
  } else if (type === "item_source_contains") {
    const item_source = item?.system?.source;
    if (item_source) {
      selected = item_source.toLowerCase().includes(value.toLowerCase());
    }
  } else if (type === "actor_value") {
    selected = check_document_value(actor, value);
  } else if (type === "item_value") {
    selected = check_document_value(item, value);
  } else if (type === "item_has_damage") {
    selected = !!item?.system?.damage;
  } else if (type === "range_less_than") {
    const tokens = actor.getActiveTokens();
    if (tokens && game.user.targets.size) {
      let use_grid_calc = SettingsUtils.getWorldSetting("range_calc_grid");
      selected =
        parseInt(value) >=
        canvas.grid.measureDistance(
          tokens[0].center,
          game.user.targets.first().center,
          { gridSpaces: use_grid_calc },
        );
    }
  } else if (type === "module_is_not_active") {
    const module = game.modules.get(value);
    selected = module && !module.active;
  } else {
    selected = false;
  }
  return selected;
}

/**
 * Checks for a value in the actor data structure
 * @param {Document} document
 * @param {string} value
 */
function check_document_value(document, value) {
  let [path, result] = value.split("=");
  let data = foundry.utils.getProperty(document, path);
  // noinspection EqualityComparisonWithCoercionJS
  return data == result;
}

// noinspection JSPrimitiveTypeWrapperUsage
/**
 * The global action selection window
 */
export class SystemGlobalConfiguration extends FormApplication {
  static get defaultOptions() {
    let options = super.defaultOptions;
    options.id = "brsw-global-actions";
    options.template =
      "/modules/betterrolls-swade2/templates/system_globals.html";
    options.height = 700;
    options.resizable = true;
    return options;
  }

  getData(_) {
    let groups = {};
    let disable_actions = SettingsUtils.getSetting("system_action_disabled");
    if (disable_actions && disable_actions[0] instanceof Array) {
      disable_actions = disable_actions[0];
    }
    for (let action of SYSTEM_GLOBAL_ACTION) {
      if (!groups.hasOwnProperty(action.group)) {
        groups[action.group] = { name: action.group, actions: [] };
      }
      groups[action.group].actions.push({
        id: action.id,
        name: game.i18n.localize(action.button_name),
        enabled: !disable_actions.includes(action.id),
      });
    }
    // noinspection JSValidateTypes
    return { groups: groups };
  }

  activateListeners(html) {
    html.find(".brsw-section-title").click((ev) => {
      // noinspection JSCheckFunctionSignatures
      const checks = $(ev.currentTarget)
        .parents("table")
        .find("input[type=checkbox]");
      if (checks.length) {
        const new_status = !$(checks[0]).prop("checked");
        checks.prop("checked", new_status);
      }
    });
    return super.activateListeners(html);
  }

  async _updateObject(_, formData) {
    let disabled_actions = [];
    for (let id in formData) {
      if (!formData[id]) {
        disabled_actions.push(id);
      }
    }
    await SettingsUtils.setSetting("system_action_disabled", disabled_actions);
  }
}

// noinspection JSPrimitiveTypeWrapperUsage
export class WorldGlobalActions extends FormApplication {
  static get defaultOptions() {
    let options = super.defaultOptions;
    options.id = "brsw-world-actions";
    options.template =
      "/modules/betterrolls-swade2/templates/world_globals.html";
    options.width = 800;
    options.height = 700;
    return options;
  }

  getData(_) {
    let actions = SettingsUtils.getSetting("world_global_actions");
    if (actions && actions[0] instanceof Array) {
      actions = actions[0];
    }
    let formatted_actions = [];
    for (let action of actions) {
      formatted_actions.push({
        name: action.name,
        id: action.id,
        json: JSON.stringify(action, undefined, 4).trim(),
      });
    }
    formatted_actions.sort((a, b) => {
      return a.id <= b.id ? -1 : 1;
    });
    // noinspection JSValidateTypes
    return { actions: formatted_actions };
  }

  async _updateObject(_, formData) {
    let new_world_actions = [];
    for (let action in formData) {
      new_world_actions.push(JSON.parse(formData[action]));
    }
    await SettingsUtils.setSetting("world_global_actions", new_world_actions);
    register_actions();
  }

  activateListeners(html) {
    // noinspection JSUnresolvedFunction
    html.find(".brsw-new-action").on("click", (ev) => {
      this.add_action(ev, html);
    });
    // noinspection JSUnresolvedFunction
    html.find(".fas.fa-trash").on("click", (ev) => {
      const row = ev.currentTarget.parentElement.parentElement;
      row.remove();
    });
    html.find(".brsw-accordion").on("click", (ev) => {
      const acc_content = ev.currentTarget.nextElementSibling;
      const is_collapsed = acc_content.classList.contains("brsw-collapsed");
      html.find(".brsw-edit-action").each((_, acc) => {
        acc.classList.add("brsw-collapsed");
      });
      if (is_collapsed) {
        acc_content.classList.remove("brsw-collapsed");
      }
    });
    html.find("textarea").on("keydown", (ev) => {
      if (ev.key === "Tab") {
        ev.preventDefault();
        const start = ev.currentTarget.selectionStart;
        const end = ev.currentTarget.selectionEnd;
        ev.currentTarget.value =
          ev.currentTarget.value.substring(0, start) +
          "    " +
          ev.currentTarget.value.substring(end);
        ev.currentTarget.selectionStart = start + 4;
        ev.currentTarget.selectionEnd = start + 4;
      }
    });
    // Activate json check on old actions
    $(".brsw-action-json").on("blur", this.check_json);
    // Export and import
    $(".brsw-export-json").on("click", export_global_actions);
    $(".brsw-import-json").on("click", import_global_actions);
    super.activateListeners(html);
  }

  check_json(ev) {
    // Checks the json in a textarea
    const text_area = ev.currentTarget;
    let error = "";
    let action;
    // Json loads.
    try {
      action = JSON.parse(text_area.value);
    } catch (_) {
      error = game.i18n.localize("BRSW.InvalidJSONError");
    }
    if (!error) {
      // Need to have an id, name
      for (let requisite of ["id", "name"]) {
        if (!action.hasOwnProperty(requisite)) {
          error = game.i18n.localize("BRSW.MissingJSON") + requisite;
        }
      }
    }
    if (!error) {
      // Check that the keys are supported
      const SUPPORTED_KEYS = [
        "id",
        "name",
        "button_name",
        "skillMod",
        "skillOverride",
        "dmgMod",
        "apMod",
        "dmgOverride",
        "defaultChecked",
        "runSkillMacro",
        "runDamageMacro",
        "raiseDamageFormula",
        "wildDieFormula",
        "rerollSkillMod",
        "rerollDamageMod",
        "selector_type",
        "selector_value",
        "and_selector",
        "group",
        "shotsUsed",
        "or_selector",
        "rof",
        "self_add_status",
        "not_selector",
        "tnOverride",
        "extra_text",
        "overrideAp",
        "multiplyDmgMod",
        "add_wild_die",
        "avoid_exploding_damage",
        "change_location",
        "group_single",
        "gm_action",
        "disable_if_module_present",
        "replaceExisting",
      ];
      for (let key in action) {
        if (SUPPORTED_KEYS.indexOf(key) < 0) {
          error = game.i18n.localize("BRSW.UnknownActionKey") + key;
        }
      }
    }
    const action_title = $(text_area.parentElement.parentElement).find(
      "button>span",
    );
    if (error) {
      // Inputs without a name are not passed to updateObject
      action_title[0].innerHTML = error;
      text_area.removeAttribute("name");
    } else {
      action_title[0].innerHTML = action.name;
      text_area.name = action.name;
    }
  }

  add_action(ev, html) {
    ev.preventDefault();
    for (let text_input of document.getElementsByClassName(
      "brsw-edit-action",
    )) {
      text_input.classList.add("brsw-collapsed");
    }
    // noinspection JSUnresolvedFunction
    const action_list = html.find(".brsw-action-list");
    let new_action = $(
      '<h2 class=\'mb-0 border-none\'><button type="button" class="p-5 font-medium text-white border border-b-0 border-gray-200 {{# if @first }}rounded-t-xl{{/if}} bg-gray-600 focus:ring-4 focus:ring-gray-700 hover:text-white hover:bg-gray-700 gap-3"><span>New</span></button></h2>',
    );
    let text_div = $(
      "<div class='p-5 border border-b-0 border-gray-200 bg-gray-500'></div>",
    );
    let new_textarea = $(
      "<textarea class='brsw-action-json bg-white' rows='9'></textarea>",
    );
    new_textarea.on("blur", this.check_json);
    let new_span = $("<span></span>");
    new_span.append(new_action);
    text_div.append(new_textarea);
    new_span.append(text_div);
    action_list.append(new_span);
  }
}

/**
 * Exports custom global actions to a json file.
 */
function export_global_actions() {
  let actions = SettingsUtils.getWorldSetting("world_global_actions");
  saveDataToFile(JSON.stringify(actions), "json", "world_actions.json");
}

/**
 * Import global actions from disk
 * @return {Promise<void>}
 */
async function import_global_actions() {
  new Dialog(
    {
      title: `Import Data: ${this.name}`,
      content: await renderTemplate("templates/apps/import-data.html", {
        hint1: "Select file to import",
      }),
      buttons: {
        import: {
          icon: '<i class="fas fa-file-import"></i>',
          label: "Import",
          callback: (html) => {
            const form = html.find("form")[0];
            if (!form.data.files.length) {
              return ui.notifications.error("You did not upload a data file!");
            }
            readTextFromFile(form.data.files[0]).then((json) => {
              SettingsUtils.setSetting(
                "world_global_actions",
                JSON.parse(json),
              );
            });
          },
        },
        no: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancel",
        },
      },
      default: "import",
    },
    {
      width: 400,
    },
  ).render(true);
}

/**
 * Get the global actions with the gm selector.
 */
function get_gm_actions() {
  let gm_actions = [];
  const disabled_actions = SettingsUtils.getSetting("system_action_disabled");
  for (let action of game.brsw.GLOBAL_ACTIONS) {
    if (
      action.selector_type === "gm_action" &&
      !disabled_actions.includes(action.id)
    ) {
      action.enable = false;
      gm_actions.push(action);
    }
  }
  return gm_actions;
}

export function register_gm_actions_settings() {
  SettingsUtils.registerSetting("gm_actions", {
    name: "GM Actions",
    default: get_gm_actions(),
    type: Array,
    scope: "world",
    config: false,
  });
}

/**
 * Get the date needed to render the gm_actions
 */
export function render_gm_actions() {
  let actions_ordered = {};
  let content = "";
  const old_actions = SettingsUtils.getSetting("gm_actions");
  let new_actions = [];
  for (let new_action of get_gm_actions()) {
    const new_action_id = new_action.id;
    const old_action = old_actions.find(
      (action) => action.id === new_action_id,
    );
    if (old_action && old_action.enable) {
      new_action.enable = true;
    }
    new_actions.push(new_action);
  }
  // noinspection JSIgnoredPromiseFromCall
  SettingsUtils.setSetting("gm_actions", new_actions);
  for (let action of new_actions) {
    if (!actions_ordered.hasOwnProperty(action.group)) {
      actions_ordered[action.group] = [];
    }
    actions_ordered[action.group].push(action);
  }
  for (let group in actions_ordered) {
    const name =
      group.slice(0, 4) === "BRSW" ? game.i18n.localize(group) : group;
    content += `<div>${name}</div>`;
    for (let action of actions_ordered[group]) {
      const name =
        action.button_name.slice(0, 4) === "BRSW"
          ? game.i18n.localize(action.button_name)
          : action.button_name;
      const marked_selected = action.enable
        ? "brws-selected brws-permanent-selected"
        : "";
      content += `<div data-action-name="${action.name}" class="brws-selectable brsw-clickable brsw-action brsw-added ${marked_selected}">${name}</div>`;
    }
    content += "</div>";
  }
  $("#brsw-gm-actions").append(content);
  const new_tags = $("#brsw-gm-actions .brsw-added");
  new_tags.click(manage_selectable_gm);
  new_tags.removeClass("brsw-added");
}
