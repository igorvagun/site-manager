// Ready-made sequences of tasks. Each step follows the previous one.
// [name key, working length in days, typical cost per day]
export const TEMPLATES = {
  site_setup: [
    ['tpl_fencing', 3, 1800],
    ['tpl_site_office', 4, 2200],
    ['tpl_survey', 2, 2600],
    ['tpl_excavation', 10, 3200],
  ],
  floor_cycle: [
    ['tpl_columns', 12, 5100],
    ['tpl_slab', 10, 4800],
    ['tpl_strip', 5, 2400],
    ['tpl_mep', 14, 2800],
  ],
  finishes: [
    ['tpl_partitions', 10, 3400],
    ['tpl_plaster', 8, 3000],
    ['tpl_flooring', 10, 2900],
    ['tpl_painting', 7, 2400],
    ['tpl_fixtures', 5, 2600],
  ],
};
