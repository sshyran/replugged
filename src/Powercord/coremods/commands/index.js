const { getModule, React, getModuleByDisplayName } = require('powercord/webpack');
const { inject, uninject } = require('powercord/injector');

const commands = require('./commands');
const SectionIconSVG = require('./components/SectionIconSVG');

const section = {
  id: 'replugged',
  type: 0,
  name: 'Replugged',
  icon: 'https://github.com/replugged-org.png'
};
let __originalSectionIcon;
let __originalApplicationIconUrl;
let __originalApplicationSections;

function joinClassNames (...args) {
  return args.join(' ');
}

module.exports = async () => {
  Object.values(commands).forEach(command => powercord.api.commands.registerCommand(command));

  const ChannelApplicationIcon = await getModule(m => m?.type?.displayName === 'ChannelApplicationIcon');
  inject('pc-commands-sections', ChannelApplicationIcon, 'type', ([ props ]) => {
    if (!props.section && props.command.__replugged) {
      props.section = section;
    }

    return [ props, {} ];
  }, true);

  const ApplicationCommandItem = await getModuleByDisplayName('ApplicationCommandItem');
  inject('pc-commands-commanditem', ApplicationCommandItem, 'default', ([ props ]) => {
    if (!props.section && props.command.__replugged) {
      props.section = section;
    }

    return [ props, {} ];
  }, true);

  const SectionIcon = await getModuleByDisplayName('ApplicationCommandDiscoverySectionIcon');
  const classes = await getModule(m => !m.mask && m.icon && m.selectable && m.wrapper);

  __originalSectionIcon = SectionIcon.default;
  SectionIcon.default = (args) => {
    const [ props ] = args;
    const isSmall = props.selectable === void 0;

    if (props.section.id === section.id) {
      const metadata = joinClassNames(classes?.wrapper, props.selectable && classes?.selectable, props.selectable && props.isSelected && classes?.selected);

      return React.createElement('div', { className: metadata }, React.createElement(SectionIconSVG, {
        width: props.width,
        height: props.height,
        className: joinClassNames(classes?.icon, props.className),
        style: {
          width: `${props.width}px`,
          height: `${props.height}px`,
          padding: !isSmall ? '4px' : 0,
          paddingBottom: !isSmall ? '1px' : 0
        }
      }));
    }

    return __originalSectionIcon(args);
  };

  const { BUILT_IN_SECTIONS } = getModule([ 'getBuiltInCommands' ], false);
  if (BUILT_IN_SECTIONS) {
    BUILT_IN_SECTIONS.replugged = section;
  }

  const Icons = await getModule([ 'getApplicationIconURL' ]);
  __originalApplicationIconUrl = Icons.getApplicationIconURL;

  Icons.getApplicationIconURL = (args) => {
    if (args[0]?.id === section.id) {
      return section.icon;
    }

    return __originalApplicationIconUrl(args);
  };

  const SearchStore = await getModule([ 'useSearchManager' ]);
  __originalApplicationSections = SearchStore.default.getApplicationSections;

  SearchStore.default.getApplicationSections = (args) => {
    try {
      const res = __originalApplicationSections(args) ?? [];

      if (!res.find(r => r.id === section.id)) {
        res.push(section);
      }

      return res;
    } catch {
      return [];
    }
  };

  inject('pc-commands-querycmds', SearchStore.default, 'getQueryCommands', ([ , , query ], res) => {
    if (!query || query?.startsWith('/')) {
      return;
    }
    res ??= [];

    for (const command of powercord.api.commands.values()) {
      if (!~command.name?.indexOf(query) || res.some(e => e.__replugged && e.id === command.id)) {
        continue;
      }

      try {
        res.unshift(command);
      } catch {
        // Discord calls Object.preventExtensions on the result when switching channels
        // Therefore, re-making the result array is required.
        res = [ ...res, command ];
      }
    }

    return res;
  });

  inject('pc-commands-searchmanager', SearchStore, 'useSearchManager', ([ , type ], res) => {
    if (type !== 1 || !powercord.api.commands.size) {
      return res;
    }

    if (!res.sectionDescriptors?.find?.(s => s.id === section.id)) {
      res.sectionDescriptors ??= [];
      res.sectionDescriptors.push(section);
    }

    if ((!res.filteredSectionId || res.filteredSectionId === section.id) && !res.activeSections.find(s => s.id === section.id)) {
      res.activeSections.push(section);
    }

    const cmds = [ ...powercord.api.commands.values() ];
    if (cmds.some(c => !res.commands?.find?.(r => c.__replugged && r.id === c.id))) {
      res.commands ??= [];

      // De-duplicate commands
      const collection = [ ...res.commands, ...cmds ];
      res.commands = [ ...new Set(collection).values() ];
    }

    if ((!res.filteredSectionId || res.filteredSectionId === section.id) && !res.commandsByActiveSection.find(r => r.section.id === section.id)) {
      res.commandsByActiveSection.push({
        section,
        data: cmds
      });
    }

    const active = res.commandsByActiveSection.find(r => r.section.id === section.id);
    if ((!res.filteredSectionId || res.filteredSectionId === section.id) && active && active.data.length === 0 && powercord.api.commands.size !== 0) {
      active.data = cmds;
    }

    /*
     * Filter out duplicate built-in sections due to a bug that causes
     * the getApplicationSections path to add another built-in commands
     * section to the section rail
    */

    const builtIn = res.sectionDescriptors.filter(s => s.id === '-1');
    if (builtIn.length > 1) {
      res.sectionDescriptors = res.sectionDescriptors.filter(s => s.id !== '-1');
      res.sectionDescriptors.push(builtIn.find(r => r.id === '-1'));
    }

    return res;
  });

  return () => {
    Object.values(commands).forEach(command => powercord.api.commands.unregisterCommand(command.command));
    uninject('pc-commands-sections');
    uninject('pc-commands-commanditem');
    uninject('pc-commands-searchmanager');
    uninject('pc-commands-querycmds');

    SectionIcon.default = __originalSectionIcon;
    SearchStore.default.getApplicationSections = __originalApplicationSections;
    Icons.getApplicationIconURL = __originalApplicationIconUrl;
  };
};
