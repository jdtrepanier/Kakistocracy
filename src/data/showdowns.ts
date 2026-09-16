import type { ShowdownDef } from '@/engine/showdown';

/**
 * Phase 3 showdowns (GAME_PLAN §7/§17: "2 showdowns — Fed, press conference"). Universal
 * for now — GAME_PLAN §7's officer-specific responses ("Lutnick can offer a Gold Card")
 * are a later-phase refinement once more of the cabinet has room-bound actions.
 */
export const SHOWDOWNS: readonly ShowdownDef[] = [
  {
    id: 'fed',
    actionId: 'lower_interest_rates',
    rounds: [
      {
        promptKey: 'showdown.fed.round1.prompt',
        choices: [
          { labelKey: 'showdown.fed.round1.choiceA', modifier: 10 },
          { labelKey: 'showdown.fed.round1.choiceB', modifier: 0 },
          { labelKey: 'showdown.fed.round1.choiceC', modifier: -10 },
        ],
      },
      {
        promptKey: 'showdown.fed.round2.prompt',
        choices: [
          { labelKey: 'showdown.fed.round2.choiceA', modifier: 10 },
          { labelKey: 'showdown.fed.round2.choiceB', modifier: 0 },
          { labelKey: 'showdown.fed.round2.choiceC', modifier: -15 },
        ],
      },
      {
        promptKey: 'showdown.fed.round3.prompt',
        choices: [
          { labelKey: 'showdown.fed.round3.choiceA', modifier: 15 },
          { labelKey: 'showdown.fed.round3.choiceB', modifier: 0 },
          { labelKey: 'showdown.fed.round3.choiceC', modifier: -10 },
        ],
      },
    ],
  },
  {
    id: 'press',
    actionId: 'press_conference',
    rounds: [
      {
        promptKey: 'showdown.press.round1.prompt',
        choices: [
          { labelKey: 'showdown.press.round1.choiceA', modifier: 5 },
          { labelKey: 'showdown.press.round1.choiceB', modifier: 10 },
          { labelKey: 'showdown.press.round1.choiceC', modifier: -10 },
        ],
      },
      {
        promptKey: 'showdown.press.round2.prompt',
        choices: [
          { labelKey: 'showdown.press.round2.choiceA', modifier: 0 },
          { labelKey: 'showdown.press.round2.choiceB', modifier: 10 },
          { labelKey: 'showdown.press.round2.choiceC', modifier: -15 },
        ],
      },
      {
        promptKey: 'showdown.press.round3.prompt',
        choices: [
          { labelKey: 'showdown.press.round3.choiceA', modifier: 10 },
          { labelKey: 'showdown.press.round3.choiceB', modifier: 0 },
          { labelKey: 'showdown.press.round3.choiceC', modifier: -5 },
        ],
      },
    ],
  },
  {
    id: 'buyCountry',
    actionId: 'buy_country',
    rounds: [
      {
        promptKey: 'showdown.buyCountry.round1.prompt',
        choices: [
          { labelKey: 'showdown.buyCountry.round1.choiceA', modifier: 10 },
          { labelKey: 'showdown.buyCountry.round1.choiceB', modifier: 15 },
          { labelKey: 'showdown.buyCountry.round1.choiceC', modifier: -15 },
        ],
      },
      {
        promptKey: 'showdown.buyCountry.round2.prompt',
        choices: [
          { labelKey: 'showdown.buyCountry.round2.choiceA', modifier: 15 },
          { labelKey: 'showdown.buyCountry.round2.choiceB', modifier: -10 },
          { labelKey: 'showdown.buyCountry.round2.choiceC', modifier: 0 },
        ],
      },
      {
        promptKey: 'showdown.buyCountry.round3.prompt',
        choices: [
          { labelKey: 'showdown.buyCountry.round3.choiceA', modifier: 5 },
          { labelKey: 'showdown.buyCountry.round3.choiceB', modifier: -5 },
          { labelKey: 'showdown.buyCountry.round3.choiceC', modifier: 10 },
        ],
      },
    ],
  },
  {
    id: 'bill',
    actionId: 'pass_big_beautiful_bill',
    rounds: [
      {
        promptKey: 'showdown.bill.round1.prompt',
        choices: [
          { labelKey: 'showdown.bill.round1.choiceA', modifier: 0 },
          { labelKey: 'showdown.bill.round1.choiceB', modifier: 10 },
          { labelKey: 'showdown.bill.round1.choiceC', modifier: -10 },
        ],
      },
      {
        promptKey: 'showdown.bill.round2.prompt',
        choices: [
          { labelKey: 'showdown.bill.round2.choiceA', modifier: 10 },
          { labelKey: 'showdown.bill.round2.choiceB', modifier: 5 },
          { labelKey: 'showdown.bill.round2.choiceC', modifier: -15 },
        ],
      },
      {
        promptKey: 'showdown.bill.round3.prompt',
        choices: [
          { labelKey: 'showdown.bill.round3.choiceA', modifier: 5 },
          { labelKey: 'showdown.bill.round3.choiceB', modifier: 15 },
          { labelKey: 'showdown.bill.round3.choiceC', modifier: -20 },
        ],
      },
    ],
  },
];

export function getShowdownForAction(actionId: string): ShowdownDef | undefined {
  return SHOWDOWNS.find((s) => s.actionId === actionId);
}
