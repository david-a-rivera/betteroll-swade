// Init scripts for version 2
/* globals Hooks, console, game, loadTemplates, Token, renderTemplate, Macro, CONFIG, foundry, Item, Dialog, ModuleManagement, $ */
import {
  activate_common_listeners,
  manage_selectable_click,
  manage_collapsables,
  BRSW_CONST,
  get_action_from_click,
  BrCommonCard,
  expose_card_class,
} from "./cards_common.js";
import {
  attribute_card_hooks,
  activate_attribute_listeners,
  activate_attribute_card_listeners,
} from "./attribute_card.js";
import {
  skill_card_hooks,
  activate_skill_listeners,
  activate_skill_card_listeners,
} from "./skill_card.js";
import {
  activate_item_listeners,
  expose_item_functions,
  activate_item_card_listeners,
} from "./item_card.js";
import { activate_damage_card_listeners } from "./damage_card.js";
import {
  register_actions,
  register_gm_actions_settings,
  SystemGlobalConfiguration,
  WorldGlobalActions,
  render_gm_actions,
  expose_global_actions_functions,
} from "./global_actions.js";
import {
  activate_incapacitation_card_listeners,
  incapacitation_card_hooks,
} from "./incapacitation_card.js";
import { OptionalRulesConfiguration } from "./optinal_rules.js";
import { activate_remove_status_card_listeners } from "./remove_status_cards.js";
import {
  manage_selectable_gm,
  register_gm_modifiers_settings,
  recover_html_from_gm_modifiers,
  manage_gm_tabs,
} from "./gm_modifiers.js";
import { create_unshaken_wrapper, create_unstun_wrapper } from "./combat.js";
import {
  ModifierSettingsConfiguration,
  changeNames,
} from "./chat_modifers_names.js";
import { setup_dialog } from "./card-dialog.js";

// Init Hook
Hooks.on(`init`, () => {
  game.brsw = {};
  game.brsw.get_action_from_click = get_action_from_click;
  register_settings_version2();
  register_actions();
  register_gm_modifiers_settings();
  register_gm_actions_settings();
});

// Base Hook
Hooks.on(`ready`, () => {
  console.log("Better Rolls 2 for SWADE | Ready");
  // Create a base object to hook functions
  // noinspection JSUndefinedPropertyAssignment
  attribute_card_hooks();
  skill_card_hooks();
  expose_item_functions();
  expose_global_actions_functions();
  expose_card_class();
  incapacitation_card_hooks();
  // Load partials.
  const templatePaths = [
    "modules/betterrolls-swade2/templates/common_card_header.html",
    "modules/betterrolls-swade2/templates/trait_roll_partial.html",
    "modules/betterrolls-swade2/templates/trait_result_partial.html",
    "modules/betterrolls-swade2/templates/damage_partial.html",
    "modules/betterrolls-swade2/templates/actions_partial.html",
    "modules/betterrolls-swade2/templates/card_dialog.html",
  ];
  loadTemplates(templatePaths).then(() => {
    console.log("Better Rolls templates preloaded");
  });
  // Collapse the chat window if needed
  if (game.settings.get("betterrolls-swade2", "collapse-chat-window")) {
    $(".brsw-chat-modifiers-window").addClass("brsw-collapsed");
    $(".brsw-chat-form i")
      .removeClass("fa-caret-down")
      .addClass("fa-caret-right");
  }
  // Add some jquery magic to allow binding our functions prior to system
  $.fn.bindFirst = function (name, fn) {
    // bind as you normally would
    // don't want to miss out on any jQuery magic
    this.on(name, fn);

    // Thanks to a comment by @Martin, adding support for
    // namespaced events too.
    this.each(function () {
      let handlers = $._data(this, "events")[name.split(".")[0]];
      // take out the handler we just inserted from the end
      let handler = handlers.pop();
      // move it at the beginning
      handlers.splice(0, 0, handler);
    });
  };
  // Set GM modifiers
  recover_html_from_gm_modifiers();
  render_gm_actions();
  manage_gm_tabs();
  // Add a hook to control combat flow.
  if (game.settings.get("betterrolls-swade2", "auto-status-cards")) {
    game.swade.effectCallbacks.set("shaken", create_unshaken_wrapper);
    game.swade.effectCallbacks.set("stunned", create_unstun_wrapper);
  }
  changeNames(); // Change the names of the modifiers
  compatibility_warnings();
  setup_dialog();
  // Remove the first hook from the hotbarDrop, hoping it is the system's
  const system_event = Hooks.events.hotbarDrop.find(
    (ev) => ev.fn.name === "onHotbarDrop",
  );
  Hooks.off("hotbarDrop", system_event.fn);
  Hooks.callAll("brswReady");
});

// Hooks on render

Hooks.on("renderChatMessage", (message, html) => {
  let br_card = message.getFlag("betterrolls-swade2", "br_data");
  if (br_card) {
    const card = new BrCommonCard(message);
    // This chat card is one of ours
    activate_common_listeners(card, html);
    if (card.type === BRSW_CONST.TYPE_ATTRIBUTE_CARD) {
      activate_attribute_card_listeners(card, html);
    } else if (card.type === BRSW_CONST.TYPE_SKILL_CARD) {
      activate_skill_card_listeners(card, html);
    } else if (card.type === BRSW_CONST.TYPE_ITEM_CARD) {
      activate_item_card_listeners(card, html);
    } else if (card.type === BRSW_CONST.TYPE_DMG_CARD) {
      activate_damage_card_listeners(message, html);
    } else if (card.type === BRSW_CONST.TYPE_INC_CARD) {
      activate_incapacitation_card_listeners(message, html);
    } else if (
      card.type === BRSW_CONST.TYPE_UNSHAKE_CARD ||
      card.type === BRSW_CONST.TYPE_UNSTUN_CARD
    ) {
      activate_remove_status_card_listeners(card, html, card.type);
    }
    // Hide forms to non-master, non owner
    if (game.user.id !== message.user.id && !game.user.isGM) {
      html.find(".brsw-form").addClass("brsw-collapsed");
    }
    // Hide master only sections
    if (!game.user.isGM) {
      html.find(".brsw-master-only").remove();
    }

    // Scroll the chat to the bottom if this is the last message
    if (game.messages.contents[game.messages.contents.length - 1] === message) {
      let chat_bar = $("#chat-log");
      if (
        chat_bar.length &&
        chat_bar[0].scrollHeight - chat_bar.height() * 2 < chat_bar[0].scrollTop
      ) {
        chat_bar[0].scrollTop = chat_bar[0].scrollHeight;
      }
    }
  }
  Hooks.call("BRSW-CardRendered");
});

// Hooks for the options form
Hooks.on("renderSidebarTab", (_, html) => {
  const place = html.find("#chat-controls");
  // noinspection JSIgnoredPromiseFromCall
  renderTemplate("modules/betterrolls-swade2/templates/options_form.html", {
    isGM: game.user.isGM,
  }).then((content) => {
    let jquery_content = $(content);
    // Activate selectable control.
    jquery_content
      .find(".brsw-player-modifiers>.brws-selectable")
      .click(manage_selectable_click);
    jquery_content
      .find(".brsw-gm-modifiers>.brws-selectable")
      .click(manage_selectable_gm);
    place.before(jquery_content);
    manage_collapsables(jquery_content);
  });
});

// Addon by JuanV, make attacks target by drag and drop
Hooks.on("dropCanvasData", (canvas, item) => {
  if (item.type === "Item" || item.type === "target_click") {
    let grid_size = canvas.scene.grid.size;
    const number_marked = canvas.tokens.targetObjects({
      x: item.x - grid_size / 2,
      y: item.y - grid_size / 2,
      height: grid_size,
      width: grid_size,
    });
    if (number_marked) {
      if (item.type === "Item") {
        Item.implementation.fromDropData(item).then((item) => {
          let token_id;
          let actor_id;
          if (item.parent.parent) {
            token_id = item.parent.parent.id;
            actor_id = item.parent.parent.actorId;
          } else {
            actor_id = item.parent.id;
          }
          const command = create_macro_command(item, actor_id, token_id);
          // sourcery skip: no-eval
          eval("(async () => {" + command + "})()"); // jshint ignore:line
        });
      } else if (item.type === "target_click") {
        const selector = `[data-message-id="${item.message_id}"] #${item.tag_id}`;
        document.querySelector(selector).click();
      }
    }
  }
});

function create_macro_command(data, actor_id, token_id) {
  const bt = "`";
  return `
            let behaviour = game.brsw.get_action_from_click(event);
            if (behaviour === 'system') {
                game.swade.rollItemMacro(${bt}${data.name}${bt});
                return;
            }
            let message;
            if (${data.type === "skill"}) {
                message = await game.brsw.create_skill_card_from_id('${token_id}', '${actor_id}', '${
                  data._id
                }');
            } else {
                message = await game.brsw.create_item_card_from_id('${token_id}', '${actor_id}', '${
                  data._id
                }');
            }
            if (event) {
                if (behaviour.includes('trait')) {
                    if (${data.type === "skill"}) {                  
                        game.brsw.roll_skill(message, $(message.content), false)
                    } else {
                        game.brsw.roll_item(message, $(message.content), false, behaviour.includes('damage'))
                    }
                }
            }
        `;
}

function create_attribute_macro(data) {
  return `
    let behaviour = game.brsw.get_action_from_click(event);
    if (behaviour === 'system') {
      game.swade.rollItemMacro("${data.attribute}");
    } else {
      origin = await fromUuid("${data.uuid}");
      const br_card = await game.brsw.create_atribute_card(origin, "${data.attribute}");
      if (behaviour.includes('trait')) {
        game.brsw.roll_attribute(br_card, false);
      }
    }
  `;
}

Hooks.on("hotbarDrop", (bar, data, slot) => {
  if (data.type === "Item") {
    Item.implementation.fromDropData(data).then((data) => {
      let token_id;
      let actor_id;
      if (data.parent.parent) {
        token_id = data.parent.parent.id;
        actor_id = data.parent.parent.actorId;
      } else {
        actor_id = data.parent.id;
      }
      const command = create_macro_command(data, actor_id, token_id);
      Macro.create({
        name: data?.name,
        type: "script",
        img: data?.img,
        command: command,
        scope: "global",
      }).then((macro) => {
        // noinspection JSIgnoredPromiseFromCall
        game.user.assignHotbarMacro(macro, slot);
      });
    });
    return false;
  } else if (data.type === "Attribute") {
    const command = create_attribute_macro(data);
    Macro.create({
      name: data.attribute,
      type: "script",
      img: "systems/swade/assets/icons/attribute.svg",
      command: command,
      scope: "global",
    }).then((macro) => {
      // noinspection JSIgnoredPromiseFromCall
      game.user.assignHotbarMacro(macro, slot);
    });
  }
});

// Hooks for Dice So Nice
Hooks.once("diceSoNiceReady", () => {
  register_dsn_settings();
});

// Character sheet hooks

["SwadeCharacterSheet", "SwadeNPCSheet", "CharacterSheet"].forEach((name) => {
  Hooks.on("render" + name, (app, html, _) => {
    activate_attribute_listeners(app, html);
    activate_skill_listeners(app, html);
    activate_item_listeners(app, html);
  });
});

// Settings

function register_settings_version2() {
  game.settings.registerMenu("betterrolls-swade2", "system_global_actions", {
    name: "BRSW.SystemGlobalMenu",
    label: "BRSW.SystemGlobalMenuLabel",
    hint: "BRSW.SystemGlobalMenuHint",
    type: SystemGlobalConfiguration,
  });
  game.settings.registerMenu("betterrolls-swade2", "world_global-Menus", {
    name: "BRSW.WorldGlobalMenu",
    label: "BRSW.WorldGlobalMenuLabel",
    hint: "BRSW.WorldGlobalMenuHint",
    type: WorldGlobalActions,
  });
  game.settings.registerMenu("betterrolls-swade2", "optional_rules", {
    name: "BRSW.OptionalRules",
    label: "BRSW.OptionalRulesLabel",
    hint: "BRSW.OptionalRulesHint",
    type: OptionalRulesConfiguration,
  });
  game.settings.registerMenu("betterrolls-swade2", "chat_modifiers_menu", {
    name: "BRSW.ChatModifiersMenu",
    label: "BRSW.ChatModifiersMenu",
    hint: "BRSW.ChatModifiersMenuHint",
    type: ModifierSettingsConfiguration,
  });
  game.settings.register("betterrolls-swade2", "system_action_disabled", {
    name: "System_Actions_disabled",
    default: [],
    type: Array,
    scope: "world",
    config: false,
  });
  game.settings.register("betterrolls-swade2", "optional_rules_enabled", {
    name: "Optional rules enabled",
    default: [],
    type: Array,
    scope: "world",
    config: false,
  });
  game.settings.register("betterrolls-swade2", "world_global_actions", {
    name: "World global actions",
    default: [],
    type: Array,
    config: false,
    scope: "world",
  });
  const br_choices = {
    system: game.i18n.localize("BRSW.Default_system_roll"),
    card: game.i18n.localize("BRSW.Show_Betterrolls_card"),
    dialog: game.i18n.localize("BRSW.Show_dialog"),
    trait: game.i18n.localize("BRSW.Show_card_and_trait"),
    trait_damage: game.i18n.localize("BRSW.Show_card_damage"),
  };
  game.settings.register("betterrolls-swade2", "click", {
    name: game.i18n.localize("BRSW.Single_click_action"),
    hint: game.i18n.localize("BRSW.Single_click_hint"),
    default: "card",
    scope: "world",
    type: String,
    choices: br_choices,
    config: true,
  });
  game.settings.register("betterrolls-swade2", "shift_click", {
    name: game.i18n.localize("BRSW.Shift_click_action"),
    hint: game.i18n.localize("BRSW.Shit_click_hint"),
    default: "system",
    scope: "world",
    type: String,
    choices: br_choices,
    config: true,
  });
  game.settings.register("betterrolls-swade2", "ctrl_click", {
    name: game.i18n.localize("BRSW.Control_click_action"),
    hint: game.i18n.localize("BRSW.Control_click_hint"),
    default: "trait",
    scope: "world",
    type: String,
    choices: br_choices,
    config: true,
  });
  game.settings.register("betterrolls-swade2", "alt_click", {
    name: game.i18n.localize("BRSW.Alt_click_action"),
    hint: game.i18n.localize("BRSW.Alt_click_hint"),
    default: "system",
    scope: "world",
    type: String,
    choices: br_choices,
    config: true,
  });
  game.settings.register("betterrolls-swade2", "default_rate_of_fire", {
    name: game.i18n.localize("BRSW.Default_rate_of_fire"),
    hint: game.i18n.localize("BRSW.Default_rate_of_fire_hint"),
    default: "max_rof",
    scope: "client",
    type: String,
    choices: {
      single_shot: game.i18n.localize("BRSW.Single_shot"),
      max_rof: game.i18n.localize("BRSW.Max_rate_of_fire"),
    },
    config: true,
  });
  game.settings.register("betterrolls-swade2", "result-card", {
    name: game.i18n.localize("BRSW.See_result_card"),
    hint: game.i18n.localize("BRSW.See_result_hint"),
    default: "all",
    scope: "world",
    type: String,
    choices: {
      master: game.i18n.localize("BRSW.Master_only_result_card"),
      all: game.i18n.localize("BRSW.Everybody"),
    },
    config: true,
  });
  game.settings.register("betterrolls-swade2", "expand-results", {
    name: game.i18n.localize("BRSW.expand-results"),
    hint: game.i18n.localize("BRSW.expand-results_hint"),
    default: false,
    scope: "world",
    type: Boolean,
    config: true,
  });
  game.settings.register("betterrolls-swade2", "expand-rolls", {
    name: game.i18n.localize("BRSW.expand-rolls"),
    hint: game.i18n.localize("BRSW.expand-rolls_hint"),
    default: false,
    scope: "world",
    type: Boolean,
    config: true,
  });
  game.settings.register("betterrolls-swade2", "collapse-chat-window", {
    name: game.i18n.localize("BRSW.collapse-chat-window"),
    hint: game.i18n.localize("BRSW.collapse-chat-window_hint"),
    default: false,
    scope: "world",
    type: Boolean,
    config: true,
  });
  game.settings.register("betterrolls-swade2", "default-ammo-management", {
    name: game.i18n.localize("BRSW.AmmoManagement"),
    hint: game.i18n.localize("BRSW.AmmoManagementHint"),
    default: true,
    scope: "world",
    type: Boolean,
    config: true,
  });
  game.settings.register("betterrolls-swade2", "default-pp-management", {
    name: game.i18n.localize("BRSW.PPManagement"),
    hint: game.i18n.localize("BRSW.PPManagementHint"),
    default: true,
    scope: "world",
    type: Boolean,
    config: true,
  });
  game.settings.register("betterrolls-swade2", "hide-weapon-actions", {
    name: game.i18n.localize("BRSW.HideWeaponActions"),
    hint: game.i18n.localize("BRSW.HideWeaponActionsHint"),
    default: false,
    scope: "world",
    type: Boolean,
    config: true,
  });
  game.settings.register("betterrolls-swade2", "wound-cap", {
    name: game.i18n.localize("BRSW.WoundCap"),
    hint: game.i18n.localize("BRSW.WoundCapHint"),
    default: 0,
    scope: "world",
    type: Number,
    config: false,
  });
  game.settings.register("betterrolls-swade2", "disable-gang-up", {
    name: game.i18n.localize("BRSW.DisableGangUp"),
    hint: game.i18n.localize("BRSW.DisableGangUpHint"),
    default: false,
    scope: "world",
    type: Boolean,
    config: true,
  });
  game.settings.register("betterrolls-swade2", "remaining_card_behaviour", {
    name: game.i18n.localize("BRSW.RemainingBehaviour"),
    hint: game.i18n.localize("BRSW.RemainingBehaviour_hint"),
    default: "everybody",
    scope: "world",
    type: String,
    choices: {
      none: game.i18n.localize("BRSW.NoOne"),
      master_only: game.i18n.localize("BRSW.MasterOnly"),
      master_and_gm: game.i18n.localize("BRSW.MasterAndGM"),
      everybody: game.i18n.localize("BRSW.Everybody"),
    },
    config: true,
  });
  game.settings.register("betterrolls-swade2", "swd-unshake", {
    name: game.i18n.localize("BRSW.SWD-Unshake"),
    hint: game.i18n.localize("BRSW.SWD-UnshakeHint"),
    default: false,
    scope: "world",
    type: Boolean,
    config: true,
  });
  game.settings.register("betterrolls-swade2", "auto-status-cards", {
    name: game.i18n.localize("BRSW.Auto-status-cards"),
    hint: game.i18n.localize("BRSW.Auto-status-cardsHint"),
    default: true,
    scope: "world",
    type: Boolean,
    config: true,
  });
  game.settings.register("betterrolls-swade2", "range_calc_grid", {
    name: game.i18n.localize("BRSW.RangeCalcUseGrid"),
    hint: game.i18n.localize("BRSW.RangeCalcUseGridHint"),
    default: false,
    scope: "world",
    type: Boolean,
    config: true,
  });
  game.settings.register("betterrolls-swade2", "chat_modifiers_names", {
    name: "Chat Modifiers Names",
    hint: "",
    default: { GM: "", Trait: "", Damage: "", ROF: "" },
    scope: "world",
    type: Object,
    config: false,
  });
  game.settings.register("betterrolls-swade2", "undeadIgnoresIllumination", {
    name: game.i18n.localize("BRSW.undeadIgnoresIllumination"),
    hint: game.i18n.localize("BRSW.undeadIgnoresIlluminationHint"),
    default: false,
    scope: "world",
    type: Boolean,
    config: true,
  });
  game.settings.register("betterrolls-swade2", "meleeDistance", {
    name: game.i18n.localize("BRSW.MeleeDistance"),
    hint: game.i18n.localize("BRSW.MeleeDistanceHint"),
    default: 1,
    scope: "world",
    type: Number,
    config: true,
  });
  game.settings.register("betterrolls-swade2", "disable_for_actions", {
    name: game.i18n.localize("BRSW.DisableActions"),
    hint: game.i18n.localize("BRSW.DisableActionsHint"),
    default: false,
    scope: "world",
    type: Boolean,
    config: true,
  });
  game.settings.register("betterrolls-swade2", "use_system_injury_table", {
    name: game.i18n.localize("BRSW.UseSystemInjuryTable"),
    hint: game.i18n.localize("BRSW.UseSystemInjuryTableHint"),
    default: false,
    scope: "world",
    type: Boolean,
    config: true,
  });
  game.settings.register("betterrolls-swade2", "max_tooltip_length", {
    name: "BRSW.MaxTooltipLength",
    label: "BRSW.MaxTooltipLengthLabel",
    hint: "BRSW.MaxTooltipLengthHint",
    type: Number,
    default: 500,
    config: true,
  });
  game.settings.register("betterrolls-swade2", "auto_popout_chat", {
    name: "BRSW.PopoutChat",
    hint: "BRSW.PopoutChatHint",
    default: false,
    type: Boolean,
    config: true,
  });
}

// Settings related to Dice So Nice.

function register_dsn_settings() {
  let theme_choice = {};
  // noinspection JSUnresolvedVariable
  for (let theme in game.dice3d.exports.COLORSETS) {
    if (game.dice3d.exports.COLORSETS.hasOwnProperty(theme)) {
      theme_choice[theme] = theme;
    }
  }
  let damage_theme_choice = Object.assign({}, theme_choice);
  damage_theme_choice.None = "None";
  game.settings.register("betterrolls-swade2", "damageDieTheme", {
    name: game.i18n.localize("BRSW.DamageDiceTheme"),
    hint: game.i18n.localize("BRSW.DamageDiceThemeHint"),
    default: "None",
    scope: "client",
    type: String,
    choices: damage_theme_choice,
    config: true,
  });
}

//Compatibility warnings:
function compatibility_warnings() {
  if (game.modules.get("swade-tools")?.active) {
    new Dialog({
      title: game.i18n.localize("BRSW.CompatibilityHeadline"),
      content: `<p>${game.i18n.localize(
        "BRSW.SwadeToolsCompatibilityWarning",
      )}</p>`,
      buttons: {
        one: {
          label: '<i class="fas fa-check"></i>',
          callback: (_) => {
            new ModuleManagement().render(true);
          },
        },
      },
    }).render(true);
  }
}
