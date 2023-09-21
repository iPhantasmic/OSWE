App.Controllers.PacketmanagerIndexController = Frontend.AppController.extend({
    $advancedPackagingToolTextarea: null,
    $packageManagerTextarea: null,
    components: ['WebsocketSudo'],
    _initialize: function() {
        var self = this;
        $('#tagSearch').keyup(function() {
            var searchString = $(this).val().toLowerCase();
            if (searchString != '') {
                $('.tags').each(function(key, object) {
                    var $object = $(object);
                    if (!$object.html().toLowerCase().match(searchString)) {
                        $object.parents('.jarviswidget').hide()
                    }
                })
            } else {
                $('.tags').parents('.jarviswidget').show()
            }
        });
        self.$advancedPackagingToolTextarea = $('.advanced-packaging-tool textarea');
        self.$packageManagerTextarea = $('#package-manager-log textarea');
        self.WebsocketSudo.setup(self.getVar('websocket_url'), self.getVar('akey'));
        self.WebsocketSudo._errorCallback = function() {
            $('#error_msg').html('<div class="alert alert-danger alert-block"><a href="#" data-dismiss="alert" class="close">×</a><h5 class="alert-heading"><i class="fa fa-warning"></i> Error</h5>Could not connect to SudoWebsocket Server</div>')
        }
        self.WebsocketSudo.connect();
        self.WebsocketSudo._success = function(e) {
            $('#package-manager-log').on('hidden.bs.modal', function(e) {
                document.location = document.location
            });
            $('.uninstall').click(function() {
                var packageName = $(this).data('package-name');
                if (!packageName) {
                    return
                }
                if ($(this).data('package-enterprise') == 1) {
                    self.WebsocketSudo.send(self.WebsocketSudo.toJson('5238f8e57e72e81d44119a8ffc3f98ea', {
                        name: $(this).data('package-apt-name')
                    }))
                } else {
                    self.WebsocketSudo.send(self.WebsocketSudo.toJson('package_uninstall', {
                        name: packageName
                    }))
                }
            });
            $('.install').click(function() {
                var $this = $(this);
                var packageUrl = $this.data('package-url');
                var packageName = $this.data('package-name');
                if (!packageUrl || !packageName) {
                    return
                }
                if ($(this).data('package-enterprise') == 0) {
                    self.WebsocketSudo.send(self.WebsocketSudo.toJson('package_install', {
                        url: packageUrl,
                        name: packageName
                    }))
                } else {
                    self.WebsocketSudo.send(self.WebsocketSudo.toJson('d41d8cd98f00b204e9800998ecf8427e', {
                        name: $(this).data('package-apt-name')
                    }))
                }
            });
            $('#apt_update').removeAttr('disabled');
            $('#apt_update').click(function() {
                self.WebsocketSudo.send(self.WebsocketSudo.toJson('apt_get_update', ''))
            })
        };
        self.WebsocketSudo._callback = function(transmitted) {
            if (transmitted.category && transmitted.category === 'action') {
                switch (transmitted.payload) {
                    case 'reload':
                        document.location = document.location;
                        break;
                    default:
                        break
                }
            }
            switch (transmitted.task) {
                case 'package_uninstall':
                case 'package_install':
                case '5238f8e57e72e81d44119a8ffc3f98ea':
                case 'd41d8cd98f00b204e9800998ecf8427e':
                    if (transmitted.category != 'notification') {
                        break
                    }
                    $('#package-manager-log').modal('show');
                    var text = transmitted.payload;
                    if (!text.match(/\n$/)) {
                        text += "\n"
                    }
                    self.$packageManagerTextarea.append(text);
                    var value = self.$packageManagerTextarea[0].scrollHeight - self.$packageManagerTextarea.height();
                    self.$packageManagerTextarea.scrollTop(value);
                    break;
                default:
                    self.$advancedPackagingToolTextarea.append(transmitted.payload);
                    var value = self.$advancedPackagingToolTextarea[0].scrollHeight - self.$advancedPackagingToolTextarea.height();
                    self.$advancedPackagingToolTextarea.scrollTop(value)
            }
        }
    }
});
App.Controllers.NagiostatsIndexController = Frontend.AppController.extend({
    hostUuid: null,
    autoLoadMax: 60,
    autoLoadPosition: 60,
    autoLoadObject: null,
    components: ['WebsocketSudo', 'Ajaxloader'],
    _initialize: function() {
        this.autoUpdate();
        this.Ajaxloader.setup();
        this.WebsocketSudo.setup(this.getVar('websocket_url'), this.getVar('akey'));
        this.WebsocketSudo._errorCallback = function() {
            $('#error_msg').html('<div class="alert alert-danger alert-block"><a href="#" data-dismiss="alert" class="close">×</a><h5 class="alert-heading"><i class="fa fa-warning"></i> Error</h5>Could not connect to SudoWebsocket Server</div>')
        }
        this.WebsocketSudo.connect();
        this.WebsocketSudo._success = function(e) {
            this.loadStats()
        }.bind(this)
        this.WebsocketSudo._callback = function(transmitted) {
            for (var key in transmitted.payload) {
                this.updateValues(key, transmitted.payload[key])
            }
            this.Ajaxloader.hide()
        }.bind(this);
        $('[nagiostats="MINPSVSVCPSC"]').html('sdfsdf')
    },
    loadStats: function() {
        this.Ajaxloader.show();
        this.WebsocketSudo.send(this.WebsocketSudo.toJson('nagiostats', []))
    },
    updateValues: function(key, value) {
        var $object = $('[nagiostats="' + key + '"]');
        var unit = $object.attr('unit');
        if (unit == 's') {
            value = value / 1000
        }
        $object.html(value + ' ' + unit);
        this.checkThresholds($object, value)
    },
    autoUpdate: function() {
        this.autoLoadObject = setInterval(function() {
            $("#autoLoadChart").sparkline([this.autoLoadPosition, (this.autoLoadMax - this.autoLoadPosition)], {
                type: 'pie',
                sliceColors: ['#3276B1', '#4C4F53']
            });
            this.autoLoadPosition--;
            if (this.autoLoadPosition == 0) {
                this.Ajaxloader.show();
                this.WebsocketSudo.send(this.WebsocketSudo.toJson('nagiostats', []));
                this.autoLoadPosition = this.autoLoadMax
            }
        }.bind(this), 250)
    },
    checkThresholds: function($object, value) {
        var notice = !1;
        value = parseInt(value);
        if (typeof $object.attr('warning') != "undefined" && typeof $object.attr('critical') != "undefined") {
            var warning = parseInt($object.attr('warning'));
            var critical = parseInt($object.attr('critical'));
            if (value >= warning && value < critical) {
                $object.addClass('txt-color-orangeDark');
                $object.removeClass('txt-color-red');
                notice = !0
            }
            if (value >= critical) {
                $object.addClass('txt-color-red');
                $object.removeClass('txt-color-orangeDark');
                notice = !0
            }
        } else if (typeof $object.attr('critical') != "undefined") {
            var critical = parseInt($object.attr('critical'));
            if (value <= critical) {
                $object.addClass('txt-color-red');
                $object.removeClass('txt-color-orangeDark');
                notice = !0
            }
        }
        if (notice === !1) {
            $object.removeClass('txt-color-orangeDark');
            $object.removeClass('txt-color-red')
        }
    }
});
App.Controllers.SystemfailuresAddController = Frontend.AppController.extend({
    _initialize: function() {
        $('#SystemdowntimeFromDate').datepicker({
            format: this.getVar('dateformat')
        });
        $('#SystemdowntimeToDate').datepicker({
            format: this.getVar('dateformat')
        })
    }
});
App.Controllers.SystemfailuresIndexController = Frontend.AppController.extend({
    $table: null,
    _initialize: function() {
        var self = this;
        $('.select_datatable').find('input').prop('checked', !0)
    }
});
App.Controllers.ContactgroupsAddController = Frontend.AppController.extend({
    $table: null,
    $contacts: null,
    components: ['Ajaxloader', 'ContainerSelectbox'],
    _initialize: function() {
        var self = this;
        this.Ajaxloader.setup();
        this.ContainerSelectbox.setup(this.Ajaxloader);
        this.ContainerSelectbox.addContainerEventListener({
            selectBoxSelector: '#ContainerParentId',
            ajaxUrl: '/contactgroups/loadContacts/:selectBoxValue:' + '.json',
            fieldTypes: {
                contacts: '#ContactgroupContact',
            },
            dataPlaceholderEmpty: self.getVar('data_placeholder_empty'),
            dataPlaceholder: self.getVar('data_placeholder')
        })
    },
});
App.Controllers.ContactgroupsEditController = Frontend.AppController.extend({
    $table: null,
    $contacts: null,
    components: ['Ajaxloader', 'ContainerSelectbox'],
    _initialize: function() {
        var self = this;
        this.Ajaxloader.setup();
        this.ContainerSelectbox.setup(this.Ajaxloader);
        this.ContainerSelectbox.addContainerEventListener({
            selectBoxSelector: '#ContainerParentId',
            ajaxUrl: '/contactgroups/loadContacts/:selectBoxValue:' + '.json',
            fieldTypes: {
                contacts: '#ContactgroupContact',
            },
            dataPlaceholderEmpty: self.getVar('data_placeholder_empty'),
            dataPlaceholder: self.getVar('data_placeholder')
        })
    },
});
App.Controllers.ContactgroupsIndexController = Frontend.AppController.extend({
    $table: null,
    components: ['Masschange'],
    _initialize: function() {
        var self = this;
        this.Masschange.setup({
            'controller': 'contactgroups',
            'checkboxattr': 'contactgroupname',
            'useDeleteMessage': 'false'
        })
    }
});
App.Controllers.CalendarsAddController = Frontend.AppController.extend({
    components: ['Ajaxloader', 'Fullcalendar'],
    _initialize: function() {
        this.Ajaxloader.setup();
        var self = this;
        var $calendar = $('#calendar');
        var events = [];
        if (this.getVar('events')) {
            events = this.getVar('events')
        }
        this.Fullcalendar.setup($calendar, events)
    },
});
App.Controllers.CalendarsEditController = Frontend.AppController.extend({
    components: ['Ajaxloader', 'Fullcalendar'],
    _initialize: function() {
        this.Ajaxloader.setup();
        var self = this;
        var $calendar = $('#calendar');
        var events = [];
        if (this.getVar('events')) {
            events = this.getVar('events')
        }
        this.Fullcalendar.setup($calendar, events)
    },
});
App.Controllers.CalendarsIndexController = Frontend.AppController.extend({
    components: ['Masschange'],
    _initialize: function() {
        this.Masschange.setup({
            'controller': 'calendars',
            'checkboxattr': 'calendarname'
        })
    }
});
App.Controllers.HostgroupsMassAddController = Frontend.AppController.extend({
    _initialize: function() {
        $('#HostgroupCreate').change(function() {
            if ($(this).prop('checked') === !0) {
                $('#createHostgroup').show();
                $('#existingHostgroup').hide()
            } else {
                $('#createHostgroup').hide();
                $('#existingHostgroup').show()
            }
        })
    }
});
App.Controllers.HostsAddController = Frontend.AppController.extend({
    $contacts: null,
    $contactgroups: null,
    $hostgroups: null,
    $tagsinput: null,
    lang: null,
    components: ['Highlight', 'Ajaxloader', 'CustomVariables', 'ContainerSelectbox'],
    _initialize: function() {
        var self = this;
        var ChosenAjaxObj = new ChosenAjax({
            id: 'HostParenthost'
        });
        this.Ajaxloader.setup();
        this.ContainerSelectbox.setup(this.Ajaxloader);
        this.ContainerSelectbox.setCallback(function(containerId) {
            var selected = ChosenAjaxObj.getSelected();
            $.ajax({
                dataType: "json",
                url: '/hosts/loadParentHostsByString.json',
                data: {
                    'angular': !0,
                    'filter[Host.name]': '',
                    'selected[]': selected,
                    'containerId': containerId
                },
                success: function(response) {
                    ChosenAjaxObj.addOptions(response.hosts);
                    ChosenAjaxObj.setSelected(selected)
                }
            })
        });
        this.ContainerSelectbox.addContainerEventListener({
            selectBoxSelector: '#HostContainerId',
            event: 'change.hostContainer',
            ajaxUrl: '/Hosts/loadElementsByContainerId/:selectBoxValue:.json',
            fieldTypes: {
                hosttemplates: '#HostHosttemplateId',
                timeperiods: '#HostNotifyPeriodId',
                checkperiods: '#HostCheckPeriodId',
                contacts: '#HostContact',
                contactgroups: '#HostContactgroup',
                hostgroups: '#HostHostgroup'
            },
            dataPlaceholderEmpty: self.getVar('data_placeholder_empty'),
            dataPlaceholder: self.getVar('data_placeholder')
        });
        this.CustomVariables.setup({
            controller: 'Hosts',
            ajaxUrl: 'addCustomMacro',
            macrotype: 'HOST',
            onClick: function() {
                self.hosttemplateManager._onChangeMacro();
                self.hosttemplateManager._activateOrUpdateMacroRestore()
            }
        });
        var $inputs = $('#HostAddForm :input');
        var values = {};
        $inputs.each(function() {
            if (this.name.length > 0) {
                values[this.name] = $(this).val()
            }
        });
        this.loadInitialData('#HostParenthost');
        var containerId = $('#HostContainerId').val();
        ChosenAjaxObj.setCallback(function(searchString) {
            var selected = ChosenAjaxObj.getSelected();
            $.ajax({
                dataType: "json",
                url: '/hosts/loadParentHostsByString.json',
                data: {
                    'angular': !0,
                    'filter[Host.name]': searchString,
                    'selected[]': selected,
                    'containerId': $('#HostContainerId').val()
                },
                success: function(response) {
                    ChosenAjaxObj.addOptions(response.hosts);
                    ChosenAjaxObj.setSelected(selected)
                }
            })
        });
        ChosenAjaxObj.render();
        $("[data-toggle='tab']").click(function() {
            $('.chosen-container').css('width', '100%')
        });
        if ($('#HostSharedContainer').length) {
            $('#HostContainerId').change(function() {
                var containerId = $(this).val()
                $.ajax({
                    url: '/Hosts/getSharingContainers/' + containerId + '.json',
                    type: 'post',
                    cache: !1,
                    dataType: 'json',
                    complete: function(response) {
                        $hostSharingContainer = $('#HostSharedContainer')
                        var prevSelectedContainer = $hostSharingContainer.val();
                        var res = response.responseJSON;
                        var html = '<select>';
                        for (var key in res) {
                            var selected = '';
                            if (Array.isArray(prevSelectedContainer) && _.contains(prevSelectedContainer, key)) {
                                selected = 'selected'
                            }
                            html += '<option value="' + key + '" ' + selected + '>' + res[key] + '</option>'
                        }
                        html += '</select>';
                        $hostSharingContainer.html(html);
                        $hostSharingContainer.trigger('chosen:updated')
                    }
                })
            })
        }
        this.$contacts = $('#HostContact');
        this.$contactgroups = $('#HostContactgroup');
        this.$hostgroups = $('#HostHostgroup');
        this.lang = [];
        this.lang[1] = this.getVar('lang_minutes');
        this.lang[2] = this.getVar('lang_seconds');
        this.lang[3] = this.getVar('lang_and');
        this.initialized = !1;
        this.fieldMap = {
            description: 'Description',
            notes: 'Notes',
            host_url: 'HostUrl',
            max_check_attempts: 'MaxCheckAttempts',
            tags: 'Tags',
            priority: 'stars-rating-5',
            check_interval: 'Checkinterval',
            retry_interval: 'Retryinterval',
            notification_interval: 'Notificationinterval',
            notify_on_recovery: 'NotifyOnRecovery',
            notify_on_down: 'NotifyOnDown',
            notify_on_unreachable: 'NotifyOnUnreachable',
            notify_on_flapping: 'NotifyOnFlapping',
            notify_on_downtime: 'NotifyOnDowntime',
            flap_detection_enabled: 'FlapDetectionEnabled',
            flap_detection_on_up: 'FlapDetectionOnUp',
            flap_detection_on_down: 'FlapDetectionOnDown',
            flap_detection_on_unreachable: 'FlapDetectionOnUnreachable',
            active_checks_enabled: 'ActiveChecksEnabled',
            command_id: 'CommandId',
            check_period_id: 'CheckPeriodId',
            notify_period_id: 'NotifyPeriodId',
            contact: 'Contact',
            contactgroup: 'Contactgroup',
            hostgroup: 'Hostgroup'
        };
        this.$tagsinput = $('.tagsinput');
        this.$tagsinput.tagsinput();
        $('input[type="checkbox"]#HostFlapDetectionEnabled').on('change.flapDetect', this.checkFlapDetection);
        this.checkFlapDetection();
        this.inputPlaceholder();
        $('input[type="checkbox"]#autoDNSlookup').on('change.inputPlaceholder', function() {
            if ($('input[type="checkbox"]#autoDNSlookup').prop('checked') == !0) {
                $.cookie('oitc_autoDNSlookup', 'true', {
                    expires: 365
                })
            } else {
                $.cookie('oitc_autoDNSlookup', 'false', {
                    expires: 365
                })
            }
            this.inputPlaceholder()
        }.bind(this));
        $('#HostName').focusout(function() {
            if ($('input[type="checkbox"]#autoDNSlookup').prop('checked')) {
                $('.ajax_icon').remove();
                var icon = '<i class="fa fa-warning fa-lg txt-color-redLight ajax_icon"></i> ';
                $hostname = $('#HostName');
                $label = $hostname.parent().parent().find('label');
                $note = $hostname.parent();
                var callback = function(response) {
                    if (response.responseText != '') {
                        $('#HostAddress').val(response.responseText);
                        this.Highlight.highlight($('#HostAddress').parent())
                    } else {
                        $label.html(icon + $label.html());
                        $note.append('<span class="note ajax_icon">' + this.getVar('dns_hostname_lookup_failed') + '</span>')
                    }
                    this.Ajaxloader.hide()
                }.bind(this);
                if ($hostname.val() != '') {
                    this.Ajaxloader.show();
                    ret = $.ajax({
                        url: "/Hosts/gethostbyname",
                        type: "POST",
                        cache: !1,
                        data: "hostname=" + encodeURIComponent($hostname.val()),
                        error: function() {},
                        success: function() {},
                        complete: callback
                    })
                }
            }
        }.bind(this));
        $('#HostAddress').focusout(function() {
            if ($('input[type="checkbox"]#autoDNSlookup').prop('checked')) {
                $('.ajax_icon').remove();
                var icon = '<i class="fa fa-warning fa-lg txt-color-redLight ajax_icon"></i> ';
                $hostaddress = $('#HostAddress');
                $label = $hostaddress.parent().parent().find('label');
                $note = $hostaddress.parent();
                var callback = function(response) {
                    if (response.responseText != '') {
                        $('#HostName').val(response.responseText);
                        this.Highlight.highlight($('#HostName').parent())
                    } else {
                        $label.html(icon + $label.html());
                        $note.append('<span class="note ajax_icon">' + this.getVar('dns_ipaddress_lookup_failed') + '</span>')
                    }
                    this.Ajaxloader.hide()
                }.bind(this);
                if ($hostaddress.val() != '') {
                    this.Ajaxloader.show();
                    ret = $.ajax({
                        url: "/Hosts/gethostbyaddr",
                        type: "POST",
                        cache: !1,
                        data: "address=" + encodeURIComponent($hostaddress.val()),
                        error: function() {},
                        success: callback,
                        complete: callback
                    })
                }
            }
        }.bind(this));
        var initValue = $('[slider-for]').val(),
            $hostNotificationIntervalField = $('#HostNotificationinterval');
        var onSlideStop = function(ev) {
            if (ev.value == null) {
                ev.value = 0
            }
            $('#_' + $(this).attr('id')).val(ev.value);
            $(this).val(ev.value).trigger('change');
            var min = parseInt(ev.value / 60, 10);
            var sec = parseInt(ev.value % 60, 10);
            $($(this).attr('human')).html(min + " " + self.lang[1] + " " + self.lang[3] + " " + sec + " " + self.lang[2])
        };
        var $slider = $('input.slider');
        $slider.slider({
            tooltip: 'hide'
        });
        $slider.slider('on', 'slide', onSlideStop);
        $slider.slider('on', 'slideStop', onSlideStop);
        var onChangeSliderInput = function() {
            var $this = $(this);
            $('#' + $this.attr('slider-for')).slider('setValue', parseInt($this.val(), 10)).val($this.val()).attr('value', $this.val()).trigger('change');
            $hostNotificationIntervalField.trigger('change');
            var min = parseInt($this.val() / 60, 10);
            var sec = parseInt($this.val() % 60, 10);
            $($this.attr('human')).html(min + " " + self.lang[1] + " " + self.lang[3] + " " + sec + " " + self.lang[2])
        };
        $('.slider-input').on('change.slider', onChangeSliderInput).on('keyup', onChangeSliderInput);
        $('#HostCommandId').on('change.hostCommand', function() {
            self.loadParameters($(this).val())
        });
        self.hosttemplateManager = {
            isRestoreFunctionalityInitialized: !1,
            isInitializedOnce: !1,
            init: function() {
                this.updateHosttemplateValues(this.initRestoreDefault)
            },
            _onChangeMacro: function() {
                var currentValueCount = 0,
                    allCurrentValues = {},
                    caseInsensitive = !0;
                $customVariablesContainer.children().each(function(index) {
                    var name = $(this).find('.macroName').val();
                    var value = $(this).find('.macroValue').val();
                    if (caseInsensitive) {
                        allCurrentValues[name.toUpperCase()] = value.toUpperCase()
                    } else {
                        allCurrentValues[name] = value
                    }
                    currentValueCount++
                });
                var templateValues = {};
                for (var key in self.hosttemplateManager.currentCustomVariables) {
                    var obj = self.hosttemplateManager.currentCustomVariables[key];
                    if (caseInsensitive) {
                        templateValues[obj.name.toUpperCase()] = obj.value.toUpperCase()
                    } else {
                        templateValues[obj.name] = obj.value
                    }
                }
                var isIdenticalWithTemplate = !0;
                if (Object.keys(templateValues).length != currentValueCount) {
                    isIdenticalWithTemplate = !1
                }
                if (isIdenticalWithTemplate) {
                    for (var name in templateValues) {
                        if (!allCurrentValues.hasOwnProperty(name)) {
                            isIdenticalWithTemplate = !1;
                            break
                        }
                        if (templateValues[name] !== allCurrentValues[name]) {
                            isIdenticalWithTemplate = !1;
                            break
                        }
                    }
                }
                self.hosttemplateManager._createOrUpdateMacroRestoreIcon(isIdenticalWithTemplate)
            },
            _restoreHostMacrosFromTemplate: function() {
                self.CustomVariables.loadMacroFromTemplate(self.hosttemplateManager.currentTemplate.id, self.hosttemplateManager._activateOrUpdateMacroRestore)
            },
            _createOrUpdateMacroRestoreIcon: function(isIdenticalWithTemplate) {
                var $macroContainer = $('.host-macro-settings'),
                    $icon = $macroContainer.find('.fa-chain-default, .fa-chain-non-default'),
                    defaultClasses = 'fa fa-chain margin-left-10 ',
                    greenIconClass = defaultClasses + 'txt-color-green fa-chain-default',
                    redIconClass = defaultClasses + 'txt-color-red fa-chain-non-default',
                    currentIconClass = (isIdenticalWithTemplate ? greenIconClass : redIconClass);
                if (!$icon.length) {
                    $icon = $('<i>', {
                        class: currentIconClass
                    });
                    $macroContainer.prepend($icon)
                }
                if (!isIdenticalWithTemplate) {
                    $icon.off('click');
                    $icon.on('click', self.hosttemplateManager._restoreHostMacrosFromTemplate)
                }
                $icon.attr('class', (isIdenticalWithTemplate ? greenIconClass : redIconClass))
            },
            _activateOrUpdateMacroRestore: function(response) {
                var $customVariablesContainer = this;
                var allCurrentValues = {};
                $('#customVariablesContainer').children().each(function(index) {
                    var fields = {
                        $name: $(this).find('.macroName'),
                        $value: $(this).find('.macroValue')
                    };
                    allCurrentValues[fields.$name.val()] = fields.$value.val();
                    for (var key in fields) {
                        if (!fields.hasOwnProperty(key)) {
                            continue
                        }
                        var $field = fields[key];
                        $field.off('change.restoreDefault').off('keyup').on('change.restoreDefault', self.hosttemplateManager._onChangeMacro).on('keyup', self.hosttemplateManager._onChangeMacro)
                    }
                });
                self.hosttemplateManager._onChangeMacro();
                $(document).off('click.macroRemove', '.deleteMacro');
                $(document).on('click.macroRemove', '.deleteMacro', self.hosttemplateManager._onChangeMacro)
            },
            deactivateRestoreFunctionality: function() {
                for (var key in self.fieldMap) {
                    var fieldId = 'Host' + self.fieldMap[key];
                    var $field = $('#' + fieldId);
                    var $fieldFormGroup = $field.parents('.form-group');
                    $fieldFormGroup.find('input, select').not('[type="hidden"]').not('[type="checkbox"]').off('change.restoreDefault');
                    $fieldFormGroup.find('.fa-chain, .fa-chain-broken').remove()
                }
                var $hostMacroSettings = $('.host-macro-settings');
                $hostMacroSettings.find('.fa-chain-default, .fa-chain-non-default').remove();
                $hostMacroSettings.off('click.MacroRemove', '.deleteMacro');
                self.hosttemplateManager.isRestoreFunctionalityInitialized = !1
            },
            onClickRestoreDefault: function() {
                var $field = $(this);
                var fieldType = self.hosttemplateManager.getFieldType($field);
                var inputId = $field.attr('id') || '';
                var keyName = getObjectKeyByValue(self.fieldMap, inputId.replace(/^(Host)/, ''));
                var templateDefaultValue = self.hosttemplateManager.currentTemplate[keyName];
                if (typeof templateDefaultValue === 'undefined') {
                    templateDefaultValue = $field.prop('data-template-default')
                }
                if (in_array(keyName, ['contact', 'contactgroup', 'hostgroup'])) {
                    switch (keyName) {
                        case 'contact':
                            templateDefaultValue = self.hosttemplateManager.currentContact.map(function(elem) {
                                return elem.id
                            });
                            break;
                        case 'contactgroup':
                            templateDefaultValue = self.hosttemplateManager.currentContactGroup.map(function(elem) {
                                return elem.id
                            });
                            break;
                        case 'hostgroup':
                            templateDefaultValue = self.hosttemplateManager.currentHostGroup.map(function(elem) {
                                return elem.id
                            });
                            break
                    }
                }
                if ($field.prop('disabled')) {
                    return
                }
                if (fieldType === 'checkbox') {
                    if (templateDefaultValue == '0') {
                        templateDefaultValue = !1
                    } else {
                        templateDefaultValue = !!templateDefaultValue
                    }
                    $field.prop('checked', templateDefaultValue).trigger('change')
                } else if (fieldType === 'select') {
                    $field.val(templateDefaultValue).trigger('chosen:updated').trigger('change')
                } else if (fieldType === 'radio') {
                    $field.parent().find('input').each(function() {
                        if ($(this).val() != templateDefaultValue) {
                            return
                        }
                        $(this).prop('checked', !0).trigger('change')
                    })
                } else if ($field.hasClass('slider')) {
                    var $otherInput = $field.parents('.form-group').find('input[type=number]');
                    $otherInput.val(templateDefaultValue).trigger('change');
                    $field.trigger('change')
                } else if ($field.hasClass('tagsinput')) {
                    var tags = templateDefaultValue.split(',');
                    $field.tagsinput('removeAll');
                    for (var key in tags) {
                        $field.tagsinput('add', tags[key])
                    }
                } else {
                    $field.val(templateDefaultValue).trigger('change')
                }
            },
            getFieldType: function($field) {
                var fieldType = $field.attr('type');
                if (!fieldType) {
                    fieldType = $field.prop('tagName').toLowerCase()
                }
                return fieldType
            },
            onChangeField: function(event) {
                var $field = $(this);
                var $label = null;
                var inputId = $field.attr('id') || '';
                var keyName = getObjectKeyByValue(self.fieldMap, inputId.replace(/^(Host)/, ''));
                var templateDefaultValue = self.hosttemplateManager.currentTemplate[keyName];
                var templateDefaultTitle = '';
                if (typeof templateDefaultValue === 'undefined') {
                    templateDefaultValue = $field.prop('data-template-default')
                }
                if (in_array(keyName, ['contact', 'contactgroup', 'hostgroup'])) {
                    switch (keyName) {
                        case 'contact':
                            templateDefaultValue = self.hosttemplateManager.currentContact.map(function(elem) {
                                return elem.id
                            });
                            templateDefaultTitle = self.hosttemplateManager.currentContact.map(function(elem) {
                                return elem.name
                            });
                            break;
                        case 'contactgroup':
                            templateDefaultValue = self.hosttemplateManager.currentContactGroup.map(function(elem) {
                                return elem.id
                            });
                            templateDefaultTitle = self.hosttemplateManager.currentContactGroup.map(function(elem) {
                                return elem.Container.name
                            });
                            break;
                        case 'hostgroup':
                            templateDefaultValue = self.hosttemplateManager.currentHostGroup.map(function(elem) {
                                return elem.id
                            });
                            templateDefaultTitle = self.hosttemplateManager.currentHostGroup.map(function(elem) {
                                return elem.Container.name
                            });
                            break
                    }
                    templateDefaultTitle = templateDefaultTitle.join(', ')
                }
                var fieldType = self.hosttemplateManager.getFieldType($field);
                var nonDefaultClassName = 'fa fa-chain-broken fa-chain-non-default txt-color-red';
                var defaultClassName = 'fa fa-chain fa-chain-default txt-color-green';
                var defaultTitle = 'Default value';
                var restoreDefaultTitle;
                if (templateDefaultTitle != '') {
                    restoreDefaultTitle = 'Restore template default: "' + templateDefaultTitle + '"'
                } else {
                    restoreDefaultTitle = 'Restore template default: "' + templateDefaultValue + '"'
                }
                if (typeof templateDefaultValue === 'undefined' || templateDefaultValue === null) {
                    return
                }
                var fieldValue = null;
                switch (fieldType) {
                    case 'checkbox':
                        if (templateDefaultValue == '0') {
                            templateDefaultValue = !1
                        } else {
                            templateDefaultValue = !!templateDefaultValue
                        }
                        fieldValue = $field.is(':checked');
                        break;
                    case 'radio':
                        fieldValue = $field.parents('.form-group').find('[name="' + $field.attr('name') + '"]:checked').val();
                        break;
                    case 'select':
                        fieldValue = $field.val();
                        if (in_array(keyName, ['contact', 'contactgroup', 'hostgroup'])) {
                            if (fieldValue === null) {
                                fieldValue = []
                            }
                        } else {
                            restoreDefaultTitle = 'Restore default: "' + $field.find('option[value="' + templateDefaultValue + '"]').text() + '"'
                        }
                        break;
                    default:
                        fieldValue = $field.val();
                        break
                }
                if (fieldValue === null) {
                    return
                }
                var wrappedOnClickRestore = function() {
                    self.hosttemplateManager.onClickRestoreDefault.call($field)
                };
                var $restoreDefaultIcon = $field.parents('.form-group').find('.fa-chain, .fa-chain-broken');
                var isEqual = (is_scalar(fieldValue) && is_scalar(templateDefaultValue) && fieldValue == templateDefaultValue) || (is_array(fieldValue) && is_array(templateDefaultValue) && is_array_equal(fieldValue, templateDefaultValue));
                if (isEqual) {
                    if (!$restoreDefaultIcon.length) {
                        $restoreDefaultIcon = $('<i>', {
                            'class': defaultClassName,
                            'title': defaultTitle
                        });
                        $field.parents('.form-group').append($restoreDefaultIcon)
                    } else {
                        $restoreDefaultIcon.attr({
                            'class': defaultClassName,
                            'title': defaultTitle
                        }).off('click')
                    }
                } else {
                    if (!$restoreDefaultIcon.length) {
                        $restoreDefaultIcon = $('<i>', {
                            'class': nonDefaultClassName,
                            'title': restoreDefaultTitle
                        });
                        $restoreDefaultIcon.on('click', wrappedOnClickRestore);
                        $field.parents('.form-group').append($restoreDefaultIcon)
                    } else {
                        $restoreDefaultIcon.attr({
                            'class': nonDefaultClassName,
                            'title': restoreDefaultTitle
                        }).off('click').on('click', wrappedOnClickRestore)
                    }
                }
            },
            initRestoreDefault: function() {
                self.hosttemplateManager.deactivateRestoreFunctionality();
                for (var key in self.fieldMap) {
                    if (!self.fieldMap.hasOwnProperty(key)) {
                        return
                    }
                    var $field = $('#Host' + self.fieldMap[key]);
                    var fieldType = $field.attr('type');
                    if (!fieldType) {
                        fieldType = $field.prop('tagName').toLowerCase()
                    }
                    switch (fieldType) {
                        case 'text':
                        case 'checkbox':
                            self.hosttemplateManager.onChangeField.call($field);
                            $field.on('change.restoreDefault', self.hosttemplateManager.onChangeField);
                            $field.on('keyup', self.hosttemplateManager.onChangeField);
                            break;
                        case 'radio':
                            var $radioFields = $field.parents('.form-group').find('[name="' + $field.attr('name') + '"]');
                            $radioFields.each(function() {
                                self.hosttemplateManager.onChangeField.call($(this));
                                $(this).on('change.restoreDefault', function() {
                                    self.hosttemplateManager.onChangeField.call($(this))
                                })
                            });
                            break;
                        case 'select':
                            self.hosttemplateManager.onChangeField.call($field);
                            $field.on('change.restoreDefault', self.hosttemplateManager.onChangeField);
                            break;
                        case 'number':
                            break;
                        case 'hidden':
                            break;
                        case 'submit':
                            break;
                        default:
                            break
                    }
                };
                self.hosttemplateManager.isRestoreFunctionalityInitialized = !0;
                self.hosttemplateManager.isInitializedOnce = !0
            },
            updateHosttemplateValues: function(onComplete) {
                self.hosttemplateManager.currentTemplate = {};
                var $selectBoxHosttemplate = $('#HostHosttemplateId');
                var ajaxCompleteCallback = function(response) {
                    var responseObject = response.responseJSON;
                    if (responseObject.code === 'not_authenticated') {
                        return
                    }
                    var hosttemplateId = $selectBoxHosttemplate.val();
                    self.hosttemplateManager.currentTemplate = responseObject.hosttemplate.Hosttemplate;
                    self.hosttemplateManager.currentContact = responseObject.hosttemplate.Contact;
                    self.hosttemplateManager.currentContactGroup = responseObject.hosttemplate.Contactgroup;
                    self.hosttemplateManager.currentCustomVariables = responseObject.hosttemplate.Customvariable;
                    self.hosttemplateManager.currentHostGroup = responseObject.hosttemplate.Hostgroup;
                    window.currentTemplate = responseObject.hosttemplate.Hosttemplate;
                    window.currentContact = responseObject.hosttemplate.Contact;
                    window.currentContactGroup = responseObject.hosttemplate.Contactgroup;
                    window.currentCompleteHosttemplate = responseObject.hosttemplate;
                    window.currentCustomVariable = responseObject.hosttemplate.Customvariable;
                    window.currentHostGroup = responseObject.hosttemplate.Hostgroup;
                    if (self.hosttemplateManager.currentTemplate.id != hosttemplateId) {
                        self.Ajaxloader.hide();
                        return
                    }
                    if (self.hosttemplateManager.isInitializedOnce) {
                        for (var key in self.fieldMap) {
                            var templateDefaultValue = self.hosttemplateManager.currentTemplate[key];
                            if (key == 'priority') {
                                $('#Hoststars-rating-' + templateDefaultValue).prop('checked', !0).parents('.form-group').find('input[type=radio]').prop('data-template-default', templateDefaultValue)
                            } else if (key == 'tags') {
                                self.updateTags({
                                    tags: templateDefaultValue
                                })
                            } else if (in_array(key, ['check_interval', 'retry_interval', 'notification_interval'])) {
                                self.updateSlider({
                                    value: templateDefaultValue,
                                    selector: self.fieldMap[key]
                                })
                            } else if (in_array(key, ['notify_period_id', 'check_period_id', 'command_id'])) {
                                self.updateSelectbox({
                                    value: templateDefaultValue,
                                    selector: self.fieldMap[key]
                                })
                            } else if (in_array(key, ['notify_on_recovery', 'notify_on_down', 'notify_on_unreachable', 'notify_on_flapping', 'notify_on_downtime', 'flap_detection_enabled', 'flap_detection_on_unreachable', 'flap_detection_on_down', 'flap_detection_on_up', 'active_checks_enabled'])) {
                                self.updateCheckbox({
                                    value: templateDefaultValue,
                                    selector: self.fieldMap[key]
                                })
                            } else {
                                $('#Host' + self.fieldMap[key]).val(templateDefaultValue)
                            }
                        }
                        var selectedContacts = [];
                        $(responseObject.hosttemplate.Contact).each(function(intIndex, jsonContact) {
                            selectedContacts.push(jsonContact.id)
                        });
                        self.updateSelectbox({
                            value: selectedContacts,
                            selector: '#HostContact',
                            prefix: 'false'
                        });
                        var selectedContactgroups = [];
                        $(responseObject.hosttemplate.Contactgroup).each(function(intIndex, jsonContactgroup) {
                            selectedContactgroups.push(jsonContactgroup.id)
                        });
                        self.updateSelectbox({
                            value: selectedContactgroups,
                            selector: '#HostContactgroup',
                            prefix: 'false'
                        });
                        var selectedHostgroups = [];
                        $(responseObject.hosttemplate.Hostgroup).each(function(intIndex, jsonHostgroup) {
                            selectedHostgroups.push(jsonHostgroup.id)
                        });
                        self.updateSelectbox({
                            value: selectedHostgroups,
                            selector: '#HostHostgroup',
                            prefix: 'false'
                        })
                    }
                    self.CustomVariables.loadMacroFromTemplate(self.hosttemplateManager.currentTemplate.id, self.hosttemplateManager._activateOrUpdateMacroRestore);
                    self.loadParametersFromTemplate(self.hosttemplateManager.currentTemplate.id);
                    self.Ajaxloader.hide();
                    onComplete()
                };
                var onChangeHosttemplate = function() {
                    self.hosttemplateManager.isRestoreFunctionalityInitialized = !0;
                    var hosttemplateId = $(this).val();
                    if (hosttemplateId <= 0) {
                        self.hosttemplateManager.currentTemplate = {};
                        self.hosttemplateManager.deactivateRestoreFunctionality();
                        return !1
                    }
                    $('#content').find('.fa-link').remove();
                    self.Ajaxloader.show();
                    $.ajax({
                        url: "/Hosts/loadHosttemplate/" + encodeURIComponent(hosttemplateId) + '.json',
                        type: "POST",
                        cache: !1,
                        dataType: "json",
                        error: function() {},
                        success: function() {},
                        complete: ajaxCompleteCallback
                    })
                };
                if (parseInt($selectBoxHosttemplate.val(), 10) > 0) {
                    onChangeHosttemplate.call($selectBoxHosttemplate)
                } else {
                    self.hosttemplateManager.isInitializedOnce = !0
                }
                $selectBoxHosttemplate.on('change.hostTemplate', onChangeHosttemplate);
                $('#HostCommandId').on('change.hostCommand', function() {
                    self.loadParameters($(this).val())
                });
                if ($('#HostCommandId').val() !== null && $('#HostHosttemplateId').val() != 0) {
                    self.loadParametersFromTemplate($('#HostHosttemplateId').val())
                }
            },
        };
        self.hosttemplateManager.init()
    },
    loadInitialData: function(selector, selectedHostIds, callback) {
        var containerId = $('#HostContainerId').val();
        var self = this;
        if (selectedHostIds == null || selectedHostIds.length < 1) {
            selectedHostIds = []
        } else {
            if (!Array.isArray(selectedHostIds)) {
                selectedHostIds = [selectedHostIds]
            }
        }
        $.ajax({
            dataType: "json",
            url: '/hosts/loadParentHostsByString.json',
            data: {
                'angular': !0,
                'selected[]': selectedHostIds,
                'containerId': containerId
            },
            success: function(response) {
                var $selector = $(selector);
                var list = self.buildList(response.hosts);
                $selector.append(list);
                $selector.val(selectedHostIds);
                $selector.trigger('chosen:updated');
                if (callback != undefined) {
                    callback()
                }
            }
        })
    },
    buildList: function(data) {
        var html = '';
        for (var i in data) {
            html += '<option value="' + data[i].key + '">' + htmlspecialchars(data[i].value) + '</option>'
        }
        return html
    },
    inputPlaceholder: function() {
        var $checkbox = $('input[type="checkbox"]#autoDNSlookup');
        if ($.cookie('oitc_autoDNSlookup') == 'false') {
            $checkbox.prop('checked', !1);
            $('#HostName').attr('placeholder', '');
            $('#HostAddress').attr('placeholder', '');
            return
        }
        if ($checkbox.prop('checked')) {
            $('#HostName').attr('placeholder', this.getVar('hostname_placeholder'));
            $('#HostAddress').attr('placeholder', this.getVar('address_placeholder'));
            $.cookie('oitc_autoDNSlookup', 'true', {
                expires: 365
            })
        } else {
            $('#HostName').attr('placeholder', '');
            $('#HostAddress').attr('placeholder', '');
            $.cookie('oitc_autoDNSlookup', 'false', {
                expires: 365
            })
        }
    },
    checkFlapDetection: function() {
        var disable = !1;
        if (!$('input[type="checkbox"]#HostFlapDetectionEnabled').prop('checked')) {
            disable = !0
        }
        $('.flapdetection_control').prop('disabled', disable)
    },
    updateTags: function(_options) {
        var options = _options || {};
        options.tags = _options.tags || "";
        options.remove = _options.remove || !0;
        if (options.remove === !0) {
            this.$tagsinput.tagsinput('removeAll')
        }
        this.$tagsinput.tagsinput('add', options.tags)
    },
    updateSlider: function(_options) {
        var options = _options || {};
        options.value = parseInt(_options.value, 10) || 0;
        options.selector = _options.selector || null;
        $('#Host' + options.selector).slider('setValue', options.value);
        $('#_Host' + options.selector).val(options.value);
        $('#Host' + options.selector).val(options.value);
        $('_#Host' + options.selector).trigger('keyup');
        $helptext = $('#Host' + options.selector + '_human');
        min = parseInt(options.value / 60, 10);
        sec = parseInt(options.value % 60, 10);
        $helptext.html(min + " " + this.lang[1] + " " + this.lang[3] + " " + sec + " " + this.lang[2])
    },
    updateCheckbox: function(_options) {
        var options = _options || {};
        options.value = _options.value || null;
        options.selector = _options.selector || '';
        if (options.value === null || options.value == 0 || options.value == !1) {
            $('input[type="checkbox"]#Host' + options.selector).prop('checked', !1).trigger('change');
            this.checkFlapDetection();
            return !1
        }
        $('input[type="checkbox"]#Host' + options.selector).prop('checked', !0).trigger('change');
        this.checkFlapDetection();
        return !0
    },
    updateSelectbox: function(_options) {
        var options = _options || {};
        options.value = _options.value || 0;
        options.selector = _options.selector || '';
        options.prefix = _options.prefix || "#Host";
        if (options.prefix == 'false') {
            options.prefix = ''
        }
        $(options.prefix + options.selector).val(options.value);
        $(options.prefix + options.selector).trigger("chosen:updated").change()
    },
    loadParameters: function(command_id) {
        this.Ajaxloader.show();
        $.ajax({
            url: "/Hosts/loadArgumentsAdd/" + encodeURIComponent(command_id),
            type: "POST",
            cache: !1,
            error: function() {},
            success: function() {},
            complete: function(response) {
                $('#CheckCommandArgs').html(response.responseText);
                this.Ajaxloader.hide()
            }.bind(this)
        })
    },
    loadParametersFromTemplate: function(hosttemplate_id) {
        $.ajax({
            url: "/Hosts/loadHosttemplatesArguments/" + encodeURIComponent(hosttemplate_id),
            type: "POST",
            cache: !1,
            error: function() {},
            success: function() {},
            complete: function(response) {
                $('#CheckCommandArgs').html(response.responseText);
                this.Ajaxloader.hide()
            }.bind(this)
        })
    }
});
App.Controllers.HostsAllocateServiceTemplateGroupController = Frontend.AppController.extend({
    components: ['Ajaxloader'],
    _initialize: function() {
        this.Ajaxloader.setup();
        var self = this;
        var url = window.location.href;
        var hostid = url.substring(url.lastIndexOf('/') + 1);
        $('#ServicetemplategroupId').change(function() {
            self.Ajaxloader.show();
            $.ajax({
                url: "/hosts/getServiceTemplatesfromGroup/" + encodeURIComponent($(this).val()) + ".json",
                type: "POST",
                cache: !1,
                data: ({
                    host_id: hostid
                }),
                error: function() {},
                success: function() {},
                complete: function(response) {
                    self.Ajaxloader.hide();
                    var existantServiceIds = [];
                    $('#allServicesFromGroup').html('');
                    $(response.responseJSON.host.Service).each(function(intKey, service) {
                        existantServiceIds.push(service.servicetemplate_id)
                    });
                    $(response.responseJSON.servicetemplategroup.Servicetemplate).each(function(intKey, id) {
                        $('#allServicesFromGroup').append('<input type=\"checkbox\" class=\"createThisService\" id=\"servicetemplate_' + id.id + '\" value=\"' + id.id + '\" name=\"data[Service][ServicesToAdd][]\" />&nbsp;<label for=\"servicetemplate_' + id.id + '\">' + id.name + ' <i class=\"text-info\">(' + id.description + ')</i></label><a style=\"display: none;\" class=\"createServiceDuplicate\" id=\"duplicate_' + id.id + '\" href=\"javascript:void(0);\" data-original-title=\"Service already exist on selected host. Tick the box to create duplicate.\" data-placement=\"right\" rel=\"tooltip\" data-container=\"body\"><i class=\"padding-left-5 fa fa-info-circle text-info\"></i></a><a style=\"display: none;\" class=\"txt-color-blueDark createServiceDuplicateDisabled\" id=\"duplicateDisabled_' + id.id + '\" href=\"javascript:void(0);\" data-original-title=\"Service already exist on selected host but is disabled. Tick the box to create duplicate.\" data-placement=\"right\" rel=\"tooltip\" data-container=\"body\"><i class=\"padding-left-5 fa fa-plug\"></i></a></br>');
                        $('#servicetemplate_' + id.id).prop('checked', !0);
                        if ($.inArray(id.id, existantServiceIds) !== -1) {
                            $('#servicetemplate_' + id.id).prop('checked', !1)
                        }
                        if ($('#servicetemplate_' + id.id).prop('checked') === !1) {
                            if (id.disabled == 1 || id.disabled == '1') {
                                $('#duplicateDisabled_' + id.id).show()
                            }
                            $('#duplicate_' + id.id).show()
                        }
                    });
                    $('[rel="tooltip"]').tooltip()
                }.bind(self)
            })
        })
    },
    enableAll: function() {
        $('.createThisService').prop('checked', !0)
    },
    disableAll: function() {
        $('.createThisService').prop('checked', null)
    },
    hideAllDuplicate: function() {
        $('.createServiceDuplicate').hide()
    },
    hideAllDuplicateDisabled: function() {
        $('.createServiceDuplicateDisabled').hide()
    }
});
App.Controllers.HostsEditDetailsController = Frontend.AppController.extend({
    _initialize: function() {
        $('#HostTags').tagsinput();
        $('.parent_checkbox').change(function() {
            var $this = $(this);
            if ($this.prop('checked')) {
                var $input = $this.parents('.editHostDetailFormInput').children('.scope').find(':input');
                $($input).each(function(key, input) {
                    $_input = $(input);
                    if ($_input.hasClass('chosen')) {
                        $_input.prop('disabled', !1);
                        $_input.trigger("chosen:updated")
                    } else {
                        $_input.prop('disabled', !1)
                    }
                })
            } else {
                var $input = $this.parents('.editHostDetailFormInput').children('.scope').find(':input');
                $($input).each(function(key, input) {
                    $_input = $(input);
                    if ($_input.hasClass('chosen')) {
                        $_input.prop('disabled', !0);
                        $_input.val('').removeAttr('selected');
                        $_input.trigger("chosen:updated")
                    } else {
                        $_input.val('').removeAttr('checked');
                        $_input.prop('disabled', !0)
                    }
                })
            }
        })
    }
});
App.Controllers.HostsEditController = Frontend.AppController.extend({
    $contacts: null,
    $contactgroups: null,
    $hostgroups: null,
    $tagsinput: null,
    lang: null,
    components: ['Highlight', 'Ajaxloader', 'CustomVariables', 'ContainerSelectbox'],
    _initialize: function() {
        var self = this;
        var ChosenAjaxObj = new ChosenAjax({
            id: 'HostParenthost'
        });
        this.Ajaxloader.setup();
        this.ContainerSelectbox.setup(this.Ajaxloader);
        this.ContainerSelectbox.setCallback(function(containerId) {
            var selected = ChosenAjaxObj.getSelected();
            $.ajax({
                dataType: "json",
                url: '/hosts/loadParentHostsByString.json',
                data: {
                    'angular': !0,
                    'filter[Host.name]': '',
                    'selected[]': selected,
                    'containerId': containerId
                },
                success: function(response) {
                    ChosenAjaxObj.addOptions(response.hosts);
                    ChosenAjaxObj.setSelected(selected)
                }
            })
        });
        this.ContainerSelectbox.addContainerEventListener({
            selectBoxSelector: '#HostContainerId',
            event: 'change.hostContainer',
            ajaxUrl: '/Hosts/loadElementsByContainerId/:selectBoxValue:/' + encodeURIComponent(self.getVar('hostId')) + '.json',
            fieldTypes: {
                hosttemplates: '#HostHosttemplateId',
                hostgroups: '#HostHostgroup',
                timeperiods: '#HostNotifyPeriodId',
                checkperiods: '#HostCheckPeriodId',
                contacts: '#HostContact',
                contactgroups: '#HostContactgroup'
            },
            dataPlaceholderEmpty: self.getVar('data_placeholder_empty'),
            dataPlaceholder: self.getVar('data_placeholder')
        });
        this.CustomVariables.setup({
            controller: 'Hosts',
            ajaxUrl: 'addCustomMacro',
            macrotype: 'HOST',
            onClick: function() {
                self.hosttemplateManager._onChangeMacro();
                self.hosttemplateManager._activateOrUpdateMacroRestore()
            }
        });
        var containerId = $('#HostContainerId').val();
        var hostID = $('#HostId').val();
        $.ajax({
            dataType: "json",
            url: '/hosts/loadParentHostsById/' + hostID + '.json',
            data: {
                'angular': !0,
                'id': hostID
            },
            success: function(response) {
                self.loadInitialData('#HostParenthost', response.parenthost)
            }
        });
        ChosenAjaxObj.setCallback(function(searchString) {
            var selected = ChosenAjaxObj.getSelected();
            $.ajax({
                dataType: "json",
                url: '/hosts/loadParentHostsByString.json',
                data: {
                    'angular': !0,
                    'filter[Host.name]': searchString,
                    'selected[]': selected,
                    'containerId': $('#HostContainerId').val(),
                    'hostId': hostID
                },
                success: function(response) {
                    ChosenAjaxObj.addOptions(response.hosts);
                    ChosenAjaxObj.setSelected(selected)
                }
            })
        });
        $('#yesDeleteHost').click(function() {
            var hostId = $(this).data('hostId');
            self.deleteHost(hostId)
        });
        ChosenAjaxObj.render();
        if ($('#HostSharedContainer').length) {
            $('#HostContainerId').change(function() {
                var oldValue = $(this).attr('oldValue');
                var containerId = $(this).val();
                $(this).attr('oldValue', containerId);
                $.ajax({
                    url: '/Hosts/getSharingContainers/' + containerId + '.json',
                    type: 'post',
                    cache: !1,
                    dataType: 'json',
                    complete: function(response) {
                        $hostSharingContainer = $('#HostSharedContainer')
                        var prevSelectedContainer = $hostSharingContainer.val();
                        var res = response.responseJSON;
                        var html = '<select>';
                        for (var key in res) {
                            var selected = '';
                            if (Array.isArray(prevSelectedContainer) && _.contains(prevSelectedContainer, key) || key == oldValue) {
                                selected = 'selected'
                            }
                            html += '<option value="' + key + '" ' + selected + '>' + res[key] + '</option>'
                        }
                        html += '</select>';
                        $hostSharingContainer.html(html);
                        $hostSharingContainer.trigger('chosen:updated')
                    }
                })
            })
        }
        var $inheritContacts = $('#inheritContacts');
        if ($inheritContacts.prop('checked') == !0) {
            $('#hostContactSelects').block({
                message: null,
                overlayCSS: {
                    opacity: 0.5,
                    cursor: 'not-allowed',
                    'background-color': 'rgb(255, 255, 255)'
                }
            })
        }
        $inheritContacts.click(function() {
            self.inherit()
        });
        if (this.getVar('ContactsInherited').inherit == !0) {
            $('#hostContactSelects').block({
                message: null,
                overlayCSS: {
                    opacity: 0.5,
                    cursor: 'not-allowed',
                    'background-color': 'rgb(255, 255, 255)'
                }
            })
        }
        var $inputs = $('#HostAddForm :input');
        var values = {};
        $inputs.each(function() {
            if (this.name.length > 0) {
                values[this.name] = $(this).val()
            }
        });
        $("[data-toggle='tab']").click(function() {
            $('.chosen-container').css('width', '100%')
        });
        this.$contacts = $('#HostContact');
        this.$contactgroups = $('#HostContactgroup');
        this.$hostgroups = $('#HostHostgroup');
        this.lang = [];
        this.lang[1] = this.getVar('lang_minutes');
        this.lang[2] = this.getVar('lang_seconds');
        this.lang[3] = this.getVar('lang_and');
        this.initialized = !1;
        this.fieldMap = {
            description: 'Description',
            notes: 'Notes',
            host_url: 'HostUrl',
            command_id: 'CommandId',
            max_check_attempts: 'MaxCheckAttempts',
            tags: 'Tags',
            priority: 'stars-rating-5',
            check_interval: 'Checkinterval',
            retry_interval: 'Retryinterval',
            notification_interval: 'Notificationinterval',
            notify_on_recovery: 'NotifyOnRecovery',
            notify_on_down: 'NotifyOnDown',
            notify_on_unreachable: 'NotifyOnUnreachable',
            notify_on_flapping: 'NotifyOnFlapping',
            notify_on_downtime: 'NotifyOnDowntime',
            flap_detection_enabled: 'FlapDetectionEnabled',
            flap_detection_on_up: 'FlapDetectionOnUp',
            flap_detection_on_down: 'FlapDetectionOnDown',
            flap_detection_on_unreachable: 'FlapDetectionOnUnreachable',
            active_checks_enabled: 'ActiveChecksEnabled',
            command_id: 'CommandId',
            check_period_id: 'CheckPeriodId',
            notify_period_id: 'NotifyPeriodId',
            contact: 'Contact',
            contactgroup: 'Contactgroup',
            hostgroup: 'Hostgroup'
        };
        this.$tagsinput = $('.tagsinput');
        this.$tagsinput.tagsinput();
        $('input[type="checkbox"]#HostFlapDetectionEnabled').on('change.flapDetect', this.checkFlapDetection);
        this.checkFlapDetection();
        this.inputPlaceholder();
        $('input[type="checkbox"]#autoDNSlookup').on('change.inputPlaceholder', function() {
            if ($('input[type="checkbox"]#autoDNSlookup').prop('checked') == !0) {
                $.cookie('oitc_autoDNSlookup', 'true', {
                    expires: 365
                })
            } else {
                $.cookie('oitc_autoDNSlookup', 'false', {
                    expires: 365
                })
            }
            this.inputPlaceholder()
        }.bind(this));
        $('#HostName').focusout(function() {
            if ($('input[type="checkbox"]#autoDNSlookup').prop('checked')) {
                $('.ajax_icon').remove();
                var icon = '<i class="fa fa-warning fa-lg txt-color-redLight ajax_icon"></i> ';
                $hostname = $('#HostName');
                $label = $hostname.parent().parent().find('label');
                $note = $hostname.parent();
                var callback = function(response) {
                    if (response.responseText != '') {
                        $('#HostAddress').val(response.responseText);
                        this.Highlight.highlight($('#HostAddress').parent())
                    } else {
                        $label.html(icon + $label.html());
                        $note.append('<span class="note ajax_icon">' + this.getVar('dns_hostname_lookup_failed') + '</span>')
                    }
                    this.Ajaxloader.hide()
                }.bind(this);
                if ($hostname.val() != '') {
                    this.Ajaxloader.show();
                    ret = $.ajax({
                        url: "/Hosts/gethostbyname",
                        type: "POST",
                        cache: !1,
                        data: "hostname=" + encodeURIComponent($hostname.val()),
                        error: function() {},
                        success: function() {},
                        complete: callback
                    })
                }
            }
        }.bind(this));
        $('#HostAddress').focusout(function() {
            if ($('input[type="checkbox"]#autoDNSlookup').prop('checked')) {
                $('.ajax_icon').remove();
                var icon = '<i class="fa fa-warning fa-lg txt-color-redLight ajax_icon"></i> ';
                $hostaddress = $('#HostAddress');
                $label = $hostaddress.parent().parent().find('label');
                $note = $hostaddress.parent();
                var callback = function(response) {
                    if (response.responseText != '') {
                        $('#HostName').val(response.responseText);
                        this.Highlight.highlight($('#HostName').parent())
                    } else {
                        $label.html(icon + $label.html());
                        $note.append('<span class="note ajax_icon">' + this.getVar('dns_ipaddress_lookup_failed') + '</span>')
                    }
                    this.Ajaxloader.hide()
                }.bind(this);
                if ($hostaddress.val() != '') {
                    this.Ajaxloader.show();
                    ret = $.ajax({
                        url: "/Hosts/gethostbyaddr",
                        type: "POST",
                        cache: !1,
                        data: "address=" + encodeURIComponent($hostaddress.val()),
                        error: function() {},
                        success: callback,
                        complete: callback
                    })
                }
            }
        }.bind(this));
        var onSlideStop = function(ev) {
            if (ev.value == null) {
                ev.value = 0
            }
            $('#_' + $(this).attr('id')).val(ev.value);
            $(this).val(ev.value).trigger('change');
            var min = parseInt(ev.value / 60, 10);
            var sec = parseInt(ev.value % 60, 10);
            $($(this).attr('human')).html(min + " " + self.lang[1] + " " + self.lang[3] + " " + sec + " " + self.lang[2])
        };
        var $hostNotificationIntervalField = $('#HostNotificationinterval');
        var $slider = $('input.slider');
        $slider.slider({
            tooltip: 'hide'
        });
        $slider.slider('on', 'slide', onSlideStop);
        $slider.slider('on', 'slideStop', onSlideStop);
        var onChangeSliderInput = function() {
            var $this = $(this);
            $('#' + $this.attr('slider-for')).slider('setValue', parseInt($this.val(), 10)).val($this.val()).attr('value', $this.val()).trigger('change');
            $hostNotificationIntervalField.trigger('change');
            var min = parseInt($this.val() / 60, 10);
            var sec = parseInt($this.val() % 60, 10);
            $($this.attr('human')).html(min + " " + self.lang[1] + " " + self.lang[3] + " " + sec + " " + self.lang[2])
        };
        $('.slider-input').on('change.slider', onChangeSliderInput).on('keyup', onChangeSliderInput);
        $('#HostCommandId').on('change.hostCommand', function() {
            self.loadParametersByCommandId($(this).val(), $('#HostHosttemplateId').val())
        });
        self.hosttemplateManager = {
            isRestoreFunctionalityInitialized: !1,
            isInitializedOnce: !1,
            init: function() {
                this.updateHosttemplateValues(this.initRestoreDefault)
            },
            _onChangeMacro: function() {
                var currentValueCount = 0,
                    allCurrentValues = {},
                    caseInsensitive = !0;
                var $customVariablesContainer = $('#customVariablesContainer');
                $customVariablesContainer.children().each(function(index) {
                    var name = $(this).find('.macroName').val();
                    var value = $(this).find('.macroValue').val();
                    if (caseInsensitive) {
                        allCurrentValues[name.toUpperCase()] = value.toUpperCase()
                    } else {
                        allCurrentValues[name] = value
                    }
                    currentValueCount++
                });
                var templateValues = {};
                for (var key in self.hosttemplateManager.currentCustomVariables) {
                    var obj = self.hosttemplateManager.currentCustomVariables[key];
                    if (caseInsensitive) {
                        templateValues[obj.name.toUpperCase()] = obj.value.toUpperCase()
                    } else {
                        templateValues[obj.name] = obj.value
                    }
                }
                var isIdenticalWithTemplate = !0;
                if (Object.keys(templateValues).length != currentValueCount) {
                    isIdenticalWithTemplate = !1
                }
                if (isIdenticalWithTemplate) {
                    for (var name in templateValues) {
                        if (!allCurrentValues.hasOwnProperty(name)) {
                            isIdenticalWithTemplate = !1;
                            break
                        }
                        if (templateValues[name] !== allCurrentValues[name]) {
                            isIdenticalWithTemplate = !1;
                            break
                        }
                    }
                }
                self.hosttemplateManager._createOrUpdateMacroRestoreIcon(isIdenticalWithTemplate)
            },
            _restoreHostMacrosFromTemplate: function() {
                self.CustomVariables.loadMacroFromTemplate(self.hosttemplateManager.currentTemplate.id, self.hosttemplateManager._activateOrUpdateMacroRestore)
            },
            _createOrUpdateMacroRestoreIcon: function(isIdenticalWithTemplate) {
                var $macroContainer = $('.host-macro-settings'),
                    $icon = $macroContainer.find('.fa-chain-default, .fa-chain-non-default'),
                    defaultClasses = 'fa fa-chain margin-left-10 ',
                    greenIconClass = defaultClasses + 'txt-color-green fa-chain-default',
                    redIconClass = defaultClasses + 'txt-color-red fa-chain-non-default',
                    currentIconClass = (isIdenticalWithTemplate ? greenIconClass : redIconClass);
                if (!$icon.length) {
                    $icon = $('<i>', {
                        class: currentIconClass
                    });
                    $macroContainer.prepend($icon)
                }
                if (!isIdenticalWithTemplate) {
                    $icon.off('click');
                    $icon.on('click', self.hosttemplateManager._restoreHostMacrosFromTemplate)
                }
                $icon.attr('class', (isIdenticalWithTemplate ? greenIconClass : redIconClass))
            },
            _activateOrUpdateMacroRestore: function(response) {
                var $customVariablesContainer = this;
                var allCurrentValues = {};
                $('#customVariablesContainer').children().each(function(index) {
                    var fields = {
                        $name: $(this).find('.macroName'),
                        $value: $(this).find('.macroValue')
                    };
                    allCurrentValues[fields.$name.val()] = fields.$value.val();
                    for (var key in fields) {
                        if (!fields.hasOwnProperty(key)) {
                            continue
                        }
                        var $field = fields[key];
                        $field.off('change.restoreDefault').off('keyup').on('change.restoreDefault', self.hosttemplateManager._onChangeMacro).on('keyup', self.hosttemplateManager._onChangeMacro)
                    }
                });
                self.hosttemplateManager._onChangeMacro();
                $(document).off('click.macroRemove', '.deleteMacro');
                $(document).on('click.macroRemove', '.deleteMacro', self.hosttemplateManager._onChangeMacro)
            },
            deactivateRestoreFunctionality: function() {
                for (var key in self.fieldMap) {
                    var fieldId = 'Host' + self.fieldMap[key];
                    var $field = $('#' + fieldId);
                    var $fieldFormGroup = $field.parents('.form-group');
                    $fieldFormGroup.find('input, select').not('[type="hidden"]').not('[type="checkbox"]').off('change.restoreDefault');
                    $fieldFormGroup.find('.fa-chain, .fa-chain-broken').remove()
                }
                var $hostMacroSettings = $('.host-macro-settings');
                $hostMacroSettings.find('.fa-chain-default, .fa-chain-non-default').remove();
                $hostMacroSettings.off('click.MacroRemove', '.deleteMacro');
                self.hosttemplateManager.isRestoreFunctionalityInitialized = !1
            },
            onClickRestoreDefault: function() {
                var $field = $(this);
                var fieldType = self.hosttemplateManager.getFieldType($field);
                var inputId = $field.attr('id') || '';
                var keyName;
                if (inputId.match(/stars-rating/)) {
                    keyName = getObjectKeyByValue(self.fieldMap, 'stars-rating-5')
                } else {
                    keyName = getObjectKeyByValue(self.fieldMap, inputId.replace(/^(Host)/, ''))
                }
                var templateDefaultValue = self.hosttemplateManager.currentTemplate[keyName];
                if (typeof templateDefaultValue === 'undefined') {
                    templateDefaultValue = $field.prop('data-template-default')
                }
                if (in_array(keyName, ['contact', 'contactgroup', 'hostgroup'])) {
                    switch (keyName) {
                        case 'contact':
                            templateDefaultValue = self.hosttemplateManager.currentContact.map(function(elem) {
                                return elem.id
                            });
                            break;
                        case 'contactgroup':
                            templateDefaultValue = self.hosttemplateManager.currentContactGroup.map(function(elem) {
                                return elem.id
                            });
                            break;
                        case 'hostgroup':
                            templateDefaultValue = self.hosttemplateManager.currentHostGroup.map(function(elem) {
                                return elem.id
                            });
                            break
                    }
                }
                if ($field.prop('disabled')) {
                    return
                }
                if (fieldType === 'checkbox') {
                    if (templateDefaultValue == '0') {
                        templateDefaultValue = !1
                    } else {
                        templateDefaultValue = !!templateDefaultValue
                    }
                    $field.prop('checked', templateDefaultValue).trigger('change')
                } else if (fieldType === 'select') {
                    $field.val(templateDefaultValue).trigger('chosen:updated').trigger('change')
                } else if (fieldType === 'radio') {
                    $field.parent().find('input').each(function() {
                        if ($(this).val() != templateDefaultValue) {
                            return
                        }
                        $(this).prop('checked', !0).trigger('change')
                    })
                } else if ($field.hasClass('slider')) {
                    var $otherInput = $field.parents('.form-group').find('input[type=number]');
                    $otherInput.val(templateDefaultValue).trigger('change');
                    $field.trigger('change')
                } else if ($field.hasClass('tagsinput')) {
                    var tags = templateDefaultValue.split(',');
                    $field.tagsinput('removeAll');
                    for (var key in tags) {
                        $field.tagsinput('add', tags[key])
                    }
                } else {
                    $field.val(templateDefaultValue).trigger('change')
                }
            },
            getFieldType: function($field) {
                var fieldType = $field.attr('type');
                if (!fieldType) {
                    fieldType = $field.prop('tagName').toLowerCase()
                }
                return fieldType
            },
            onChangeField: function(event) {
                var $field = $(this);
                var $label = null;
                var inputId = $field.attr('id') || '';
                var keyName;
                if (inputId.match(/stars-rating/)) {
                    keyName = getObjectKeyByValue(self.fieldMap, 'stars-rating-5')
                } else {
                    keyName = getObjectKeyByValue(self.fieldMap, inputId.replace(/^(Host)/, ''))
                }
                var templateDefaultValue = self.hosttemplateManager.currentTemplate[keyName];
                var templateDefaultTitle = '';
                if (typeof templateDefaultValue === 'undefined') {
                    templateDefaultValue = $field.prop('data-template-default')
                }
                if (in_array(keyName, ['contact', 'contactgroup', 'hostgroup'])) {
                    switch (keyName) {
                        case 'contact':
                            templateDefaultValue = self.hosttemplateManager.currentContact.map(function(elem) {
                                return elem.id
                            });
                            templateDefaultTitle = self.hosttemplateManager.currentContact.map(function(elem) {
                                return elem.name
                            });
                            break;
                        case 'contactgroup':
                            templateDefaultValue = self.hosttemplateManager.currentContactGroup.map(function(elem) {
                                return elem.id
                            });
                            templateDefaultTitle = self.hosttemplateManager.currentContactGroup.map(function(elem) {
                                return elem.Container.name
                            });
                            break;
                        case 'hostgroup':
                            templateDefaultValue = self.hosttemplateManager.currentHostGroup.map(function(elem) {
                                return elem.id
                            });
                            templateDefaultTitle = self.hosttemplateManager.currentHostGroup.map(function(elem) {
                                return elem.Container.name
                            });
                            break
                    }
                    templateDefaultTitle = templateDefaultTitle.join(', ')
                }
                var fieldType = self.hosttemplateManager.getFieldType($field);
                var nonDefaultClassName = 'fa fa-chain-broken fa-chain-non-default txt-color-red';
                var defaultClassName = 'fa fa-chain fa-chain-default txt-color-green';
                var defaultTitle = 'Default value';
                var restoreDefaultTitle;
                if (templateDefaultTitle != '') {
                    restoreDefaultTitle = 'Restore template default: "' + templateDefaultTitle + '"'
                } else {
                    restoreDefaultTitle = 'Restore template default: "' + templateDefaultValue + '"'
                }
                if (typeof templateDefaultValue === 'undefined' || templateDefaultValue === null) {
                    return
                }
                var fieldValue = null;
                switch (fieldType) {
                    case 'checkbox':
                        if (templateDefaultValue == '0') {
                            templateDefaultValue = !1
                        } else {
                            templateDefaultValue = !!templateDefaultValue
                        }
                        fieldValue = $field.is(':checked');
                        break;
                    case 'radio':
                        fieldValue = $field.parents('.form-group').find('[name="' + $field.attr('name') + '"]:checked').val();
                        break;
                    case 'select':
                        fieldValue = $field.val();
                        if (in_array(keyName, ['contact', 'contactgroup', 'hostgroup'])) {
                            if (fieldValue === null) {
                                fieldValue = []
                            }
                        } else {
                            restoreDefaultTitle = 'Restore default: "' + $field.find('option[value="' + templateDefaultValue + '"]').text() + '"'
                        }
                        break;
                    default:
                        fieldValue = $field.val();
                        break
                }
                if (fieldValue === null) {
                    return
                }
                var wrappedOnClickRestore = function() {
                    self.hosttemplateManager.onClickRestoreDefault.call($field)
                };
                var $restoreDefaultIcon = $field.parents('.form-group').find('.fa-chain, .fa-chain-broken');
                var isEqual = (is_scalar(fieldValue) && is_scalar(templateDefaultValue) && fieldValue == templateDefaultValue) || (is_array(fieldValue) && is_array(templateDefaultValue) && is_array_equal(fieldValue, templateDefaultValue));
                if (isEqual) {
                    if (!$restoreDefaultIcon.length) {
                        $restoreDefaultIcon = $('<i>', {
                            'class': defaultClassName,
                            'title': defaultTitle
                        });
                        $field.parents('.form-group').append($restoreDefaultIcon)
                    } else {
                        $restoreDefaultIcon.attr({
                            'class': defaultClassName,
                            'title': defaultTitle
                        }).off('click')
                    }
                } else {
                    if (!$restoreDefaultIcon.length) {
                        $restoreDefaultIcon = $('<i>', {
                            'class': nonDefaultClassName,
                            'title': restoreDefaultTitle
                        });
                        $restoreDefaultIcon.on('click', wrappedOnClickRestore);
                        $field.parents('.form-group').append($restoreDefaultIcon)
                    } else {
                        $restoreDefaultIcon.attr({
                            'class': nonDefaultClassName,
                            'title': restoreDefaultTitle
                        }).off('click').on('click', wrappedOnClickRestore)
                    }
                }
            },
            initRestoreDefault: function() {
                for (var key in self.fieldMap) {
                    if (!self.fieldMap.hasOwnProperty(key)) {
                        return
                    }
                    var $field = $('#Host' + self.fieldMap[key]);
                    var fieldType = $field.attr('type');
                    if (!fieldType) {
                        fieldType = $field.prop('tagName').toLowerCase()
                    }
                    switch (fieldType) {
                        case 'text':
                        case 'checkbox':
                            self.hosttemplateManager.onChangeField.call($field);
                            $field.on('change.restoreDefault', self.hosttemplateManager.onChangeField);
                            $field.on('keyup', self.hosttemplateManager.onChangeField);
                            break;
                        case 'radio':
                            var $radioFields = $field.parents('.form-group').find('[name="' + $field.attr('name') + '"]');
                            $radioFields.each(function() {
                                self.hosttemplateManager.onChangeField.call($(this));
                                $(this).on('change.restoreDefault', function() {
                                    self.hosttemplateManager.onChangeField.call($(this))
                                })
                            });
                            break;
                        case 'select':
                            self.hosttemplateManager.onChangeField.call($field);
                            $field.on('change.restoreDefault', self.hosttemplateManager.onChangeField);
                            break;
                        case 'number':
                            break;
                        case 'hidden':
                            break;
                        case 'submit':
                            break;
                        default:
                            break
                    }
                }
                self.hosttemplateManager.isRestoreFunctionalityInitialized = !0;
                self.hosttemplateManager.isInitializedOnce = !0
            },
            updateHosttemplateValues: function(onComplete) {
                self.hosttemplateManager.currentTemplate = {};
                var $selectBoxHosttemplate = $('#HostHosttemplateId');
                var ajaxCompleteCallback = function(response) {
                    var responseObject = response.responseJSON;
                    if (responseObject.code === 'not_authenticated' || responseObject.hosttemplate.length == 0) {
                        return
                    }
                    var hosttemplateId = $selectBoxHosttemplate.val();
                    self.hosttemplateManager.currentTemplate = responseObject.hosttemplate.Hosttemplate;
                    self.hosttemplateManager.currentContact = responseObject.hosttemplate.Contact;
                    self.hosttemplateManager.currentContactGroup = responseObject.hosttemplate.Contactgroup;
                    self.hosttemplateManager.currentCustomVariables = responseObject.hosttemplate.Customvariable;
                    self.hosttemplateManager.currentHostGroup = responseObject.hosttemplate.Hostgroup;
                    window.currentTemplate = responseObject.hosttemplate.Hosttemplate;
                    window.currentContact = responseObject.hosttemplate.Contact;
                    window.currentContactGroup = responseObject.hosttemplate.Contactgroup;
                    window.currentCompleteHosttemplate = responseObject.hosttemplate;
                    window.currentCustomVariable = responseObject.hosttemplate.Customvariable;
                    window.currentHostGroup = responseObject.hosttemplate.Hostgroup;
                    if (self.hosttemplateManager.currentTemplate.id != hosttemplateId) {
                        self.Ajaxloader.hide();
                        return
                    }
                    if (self.hosttemplateManager.isInitializedOnce) {
                        for (var key in self.fieldMap) {
                            var templateDefaultValue = self.hosttemplateManager.currentTemplate[key];
                            if (key == 'priority') {
                                $('#Hoststars-rating-' + templateDefaultValue).prop('checked', !0).parents('.form-group').find('input[type=radio]').prop('data-template-default', templateDefaultValue)
                            } else if (key == 'tags') {
                                self.updateTags({
                                    tags: templateDefaultValue
                                })
                            } else if (in_array(key, ['check_interval', 'retry_interval', 'notification_interval'])) {
                                self.updateSlider({
                                    value: templateDefaultValue,
                                    selector: self.fieldMap[key]
                                })
                            } else if (in_array(key, ['notify_period_id', 'check_period_id', 'command_id'])) {
                                self.updateSelectbox({
                                    value: templateDefaultValue,
                                    selector: self.fieldMap[key]
                                })
                            } else if (in_array(key, ['notify_on_recovery', 'notify_on_down', 'notify_on_unreachable', 'notify_on_flapping', 'notify_on_downtime', 'flap_detection_enabled', 'flap_detection_on_unreachable', 'flap_detection_on_down', 'flap_detection_on_up', 'active_checks_enabled'])) {
                                self.updateCheckbox({
                                    value: templateDefaultValue,
                                    selector: self.fieldMap[key]
                                })
                            } else {
                                $('#Host' + self.fieldMap[key]).val(templateDefaultValue)
                            }
                        }
                        var selectedContacts = [];
                        $(responseObject.hosttemplate.Contact).each(function(intIndex, jsonContact) {
                            selectedContacts.push(jsonContact.id)
                        });
                        self.updateSelectbox({
                            value: selectedContacts,
                            selector: '#HostContact',
                            prefix: 'false'
                        });
                        var selectedContactgroups = [];
                        $(responseObject.hosttemplate.Contactgroup).each(function(intIndex, jsonContactgroup) {
                            selectedContactgroups.push(jsonContactgroup.id)
                        });
                        self.updateSelectbox({
                            value: selectedContactgroups,
                            selector: '#HostContactgroup',
                            prefix: 'false'
                        });
                        var selectedHostgroups = [];
                        $(responseObject.hosttemplate.Hostgroup).each(function(intIndex, jsonHostgroup) {
                            selectedHostgroups.push(jsonHostgroup.id)
                        });
                        self.updateSelectbox({
                            value: selectedHostgroups,
                            selector: '#HostHostgroup',
                            prefix: 'false'
                        })
                    }
                    var hostHasOwnMacros = $('.host-macro-settings').find('input[type=hidden]').length > 0;
                    if (hostHasOwnMacros) {
                        self.hosttemplateManager._activateOrUpdateMacroRestore()
                    } else {
                        self.CustomVariables.loadMacroFromTemplate(self.hosttemplateManager.currentTemplate.id, self.hosttemplateManager._activateOrUpdateMacroRestore)
                    }
                    self.Ajaxloader.hide();
                    onComplete()
                };
                var onChangeHosttemplate = function() {
                    self.hosttemplateManager.isRestoreFunctionalityInitialized = !0;
                    var hosttemplateId = $(this).val();
                    if (hosttemplateId <= 0) {
                        self.hosttemplateManager.currentTemplate = {};
                        self.hosttemplateManager.deactivateRestoreFunctionality();
                        return !1
                    }
                    $('#content').find('.fa-link').remove();
                    self.Ajaxloader.show();
                    $.ajax({
                        url: "/Hosts/loadHosttemplate/" + encodeURIComponent(hosttemplateId) + '.json',
                        type: "POST",
                        cache: !1,
                        dataType: "json",
                        error: function() {},
                        success: function() {},
                        complete: ajaxCompleteCallback
                    })
                };
                if (parseInt($selectBoxHosttemplate.val(), 10) > 0) {
                    onChangeHosttemplate.call($selectBoxHosttemplate)
                } else {
                    self.hosttemplateManager.isInitializedOnce = !0
                }
                $selectBoxHosttemplate.on('change.hostTemplate', function() {
                    onChangeHosttemplate.call(this);
                    self.loadParametersFromTemplate($(this).val())
                });
                if ($('#HostCommandId').val() !== null && $('#HostHosttemplateId').val() != 0) {}
            }
        };
        self.hosttemplateManager.init()
    },
    loadInitialData: function(selector, selectedHostIds) {
        var containerId = $('#HostContainerId').val();
        var self = this;
        if (selectedHostIds == null || selectedHostIds.length < 1) {
            selectedHostIds = []
        } else {
            if (!Array.isArray(selectedHostIds)) {
                selectedHostIds = [selectedHostIds]
            }
        }
        $.ajax({
            dataType: "json",
            url: '/hosts/loadParentHostsByString.json',
            data: {
                'angular': !0,
                'selected[]': selectedHostIds,
                'containerId': containerId,
                'hostId': $('#HostId').val()
            },
            success: function(response) {
                var $selector = $(selector);
                var list = self.buildList(response.hosts);
                $selector.append(list);
                $selector.val(selectedHostIds);
                $selector.trigger('chosen:updated')
            }
        })
    },
    buildList: function(data) {
        var html = '';
        for (var i in data) {
            html += '<option value="' + data[i].key + '">' + htmlspecialchars(data[i].value) + '</option>'
        }
        return html
    },
    inputPlaceholder: function() {
        var $checkbox = $('input[type="checkbox"]#autoDNSlookup');
        if ($.cookie('oitc_autoDNSlookup') == 'false') {
            $checkbox.prop('checked', !1);
            $('#HostName').attr('placeholder', '');
            $('#HostAddress').attr('placeholder', '');
            return
        }
        if ($checkbox.prop('checked')) {
            $('#HostName').attr('placeholder', this.getVar('hostname_placeholder'));
            $('#HostAddress').attr('placeholder', this.getVar('address_placeholder'));
            $.cookie('oitc_autoDNSlookup', 'true', {
                expires: 365
            })
        } else {
            $('#HostName').attr('placeholder', '');
            $('#HostAddress').attr('placeholder', '');
            $.cookie('oitc_autoDNSlookup', 'false', {
                expires: 365
            })
        }
    },
    checkFlapDetection: function() {
        var disable = !1;
        if (!$('input[type="checkbox"]#HostFlapDetectionEnabled').prop('checked')) {
            disable = !0
        }
        $('.flapdetection_control').prop('disabled', disable)
    },
    updateTags: function(_options) {
        var options = _options || {};
        options.tags = _options.tags || "";
        options.remove = _options.remove || !0;
        if (options.remove === !0) {
            this.$tagsinput.tagsinput('removeAll')
        }
        this.$tagsinput.tagsinput('add', options.tags)
    },
    updateSlider: function(_options) {
        var options = _options || {};
        options.value = parseInt(_options.value, 10) || 0;
        options.selector = _options.selector || null;
        $('#Host' + options.selector).slider('setValue', options.value);
        $('#_Host' + options.selector).val(options.value);
        $('#Host' + options.selector).val(options.value);
        $('_#Host' + options.selector).trigger('keyup');
        $helptext = $('#Host' + options.selector + '_human');
        min = parseInt(options.value / 60, 10);
        sec = parseInt(options.value % 60, 10);
        $helptext.html(min + " " + this.lang[1] + " " + this.lang[3] + " " + sec + " " + this.lang[2])
    },
    updateCheckbox: function(_options) {
        var options = _options || {};
        options.value = _options.value || null;
        options.selector = _options.selector || '';
        if (options.value === null || options.value == 0 || options.value == !1) {
            $('input[type="checkbox"]#Host' + options.selector).prop('checked', !1).trigger('change');
            this.checkFlapDetection();
            return !1
        }
        $('input[type="checkbox"]#Host' + options.selector).prop('checked', !0).trigger('change');
        this.checkFlapDetection();
        return !0
    },
    updateSelectbox: function(_options) {
        var options = _options || {};
        options.value = _options.value || 0;
        options.selector = _options.selector || '';
        options.prefix = _options.prefix || "#Host";
        if (options.prefix == 'false') {
            options.prefix = ''
        }
        $(options.prefix + options.selector).val(options.value);
        $(options.prefix + options.selector).trigger("chosen:updated").change()
    },
    loadParametersByCommandId: function(command_id, hosttemplate_id) {
        this.Ajaxloader.show();
        $.ajax({
            url: "/Hosts/loadParametersByCommandId/" + encodeURIComponent(command_id) + "/" + encodeURIComponent(hosttemplate_id),
            type: "POST",
            cache: !1,
            error: function() {},
            success: function() {},
            complete: function(response) {
                $('#CheckCommandArgs').html(response.responseText);
                this.Ajaxloader.hide()
            }.bind(this)
        })
    },
    loadParameters: function(command_id) {
        this.Ajaxloader.show();
        $.ajax({
            url: "/Hosts/loadArgumentsAdd/" + encodeURIComponent(command_id),
            type: "POST",
            cache: !1,
            error: function() {},
            success: function() {},
            complete: function(response) {
                $('#CheckCommandArgs').html(response.responseText);
                this.Ajaxloader.hide()
            }.bind(this)
        })
    },
    loadParametersFromTemplate: function(hosttemplate_id) {
        $.ajax({
            url: "/Hosts/loadHosttemplatesArguments/" + encodeURIComponent(hosttemplate_id),
            type: "POST",
            cache: !1,
            error: function() {},
            success: function() {},
            complete: function(response) {
                $('#CheckCommandArgs').html(response.responseText);
                this.Ajaxloader.hide()
            }.bind(this)
        })
    },
    inherit: function() {
        $inheritCheckbox = $('#inheritContacts');
        if ($inheritCheckbox.prop('checked') == !0) {
            $('#hostContactSelects').block({
                message: null,
                overlayCSS: {
                    opacity: 0.5,
                    cursor: 'not-allowed',
                    'background-color': 'rgb(255, 255, 255)'
                }
            });
            var Contact = this.getVar('ContactsInherited').Contact;
            if (Contact != null) {
                $('#HostContact').val('').trigger('chosen:updated');
                for (var contactId in Contact) {
                    if ($('#HostContact option[value="' + contactId + '"]').length > 0) {
                        $('#HostContact option[value="' + contactId + '"]').val(contactId).prop('selected', !0)
                    }
                }
                $('#HostContact').trigger('chosen:updated')
            }
            var Contactgroup = this.getVar('ContactsInherited').Contactgroup;
            if (Contactgroup != null) {
                $('#HostContactgroup').val('').trigger('chosen:updated');
                for (var ContactgroupId in Contactgroup) {
                    if ($('#HostContactgroup option[value="' + ContactgroupId + '"]').length > 0) {
                        $('#HostContactgroup option[value="' + ContactgroupId + '"]').val(ContactgroupId).prop('selected', !0)
                    }
                }
                $('#HostContactgroup').trigger('chosen:updated')
            }
            $('#HostContact').prop('readonly', !0);
            $('#HostContactgroup').prop('readonly', !0)
        } else {
            $('#hostContactSelects').unblock();
            $('#HostContact').prop('readonly', !1);
            $('#hostContactgroupSelects').unblock();
            $('#HostContactgroup').prop('readonly', !1)
        }
    },
    getContainerElements: function(containerId, hosttemplateId) {
        this.Ajaxloader.show();
        $.ajax({
            url: '/Hosts/loadElementsByContainerId/' + containerId + '/' + encodeURIComponent(this.getVar('hostId')) + '.json',
            type: "POST",
            cache: !1,
            error: function() {},
            success: function() {},
            complete: function(response) {
                this.compareContainerElements(response.responseJSON, hosttemplateId);
                console.log(response.responseJSON);
                this.Ajaxloader.hide()
            }.bind(this)
        })
    },
    compareContainerElements: function(obj, hosttemplateId) {
        console.log(hosttemplateId);
        console.log(obj.hosttemplates);
        hosttemplateExists = !1;
        for (var key in obj.hosttemplates) {
            if (obj.hosttemplates[key].key == hosttemplateId) {
                hosttemplateExists = !0
            }
        }
        console.log(hosttemplateExists)
    },
    deleteHost: function(id) {
        $.ajax({
            dataType: "json",
            url: '/hosts/delete/' + id + '.json',
            method: 'POST',
            data: {
                'angular': !0
            },
            success: function(response) {
                $('#successDelete').show();
                setTimeout(function() {
                    window.location.href = '/hosts/index/'
                }, 700)
            },
            error: function(request, status, error) {
                var errorMsg = request.responseJSON.message;
                var usedBy = request.responseJSON.usedBy;
                var errorHtml = '<div class="text-danger">';
                errorHtml += '<div class="text-danger">' + errorMsg + '</div>';
                for (var key in usedBy) {
                    errorHtml += '<div class="text-danger">';
                    errorHtml += '<i class="fa fa-times"></i>';
                    errorHtml += ' ';
                    errorHtml += '<a class="text-danger" href="' + usedBy[key].baseUrl + id + '">' + usedBy[key].message + '</a>';
                    errorHtml += '</div>'
                }
                errorHtml += '</div>';
                $('#errorOnDelete').html(errorHtml)
            }
        })
    }
});
App.Controllers.AdministratorsDebugController = Frontend.AppController.extend({
    components: ['WebsocketSudo'],
    argumentNames: null,
    _initialize: function() {
        if (this.getVar('renderGraph') === !0) {
            $('#loadGraph').html('');
            $('#loadGraph').css('height', '300px');
            $('.graph_legend').show();
            var line1 = [];
            var line5 = [];
            var line15 = [];
            var data = this.getVar('graphData');
            for (var timestamp in data[1]) {
                line1.push([timestamp, data[1][timestamp]])
            }
            for (var timestamp in data[5]) {
                line5.push([timestamp, data[5][timestamp]])
            }
            for (var timestamp in data[15]) {
                line15.push([timestamp, data[15][timestamp]])
            }
            var options = {
                xaxis: {
                    mode: "time"
                },
                series: {
                    lines: {
                        show: !0,
                        lineWidth: 1,
                        fill: !1,
                        fillColor: {
                            colors: [{
                                opacity: 0.1
                            }, {
                                opacity: 0.15
                            }]
                        }
                    },
                    points: {
                        show: !1
                    },
                    shadowSize: 0
                },
                grid: {
                    hoverable: !1,
                    clickable: !1,
                    tickColor: '#efefef',
                    borderWidth: 0,
                    borderColor: '#efefef',
                },
                tooltip: !1,
                colors: ['#6595B4', '#7E9D3A', '#E24913'],
            };
            var plot = $.plot($("#loadGraph"), [line1, line5, line15], options)
        }
        this.WebsocketSudo.setup(this.getVar('websocket_url'), this.getVar('akey'));
        this.WebsocketSudo._errorCallback = function() {
            $('#error_msg').html('<div class="alert alert-danger alert-block"><a href="#" data-dismiss="alert" class="close">×</a><h5 class="alert-heading"><i class="fa fa-warning"></i> Error</h5>Could not connect to SudoWebsocket Server</div>')
        }
        this.WebsocketSudo.connect()
    }
});
App.Controllers.ExportsIndexController = Frontend.AppController.extend({
    $exportLog: null,
    worker: null,
    components: ['Ajaxloader'],
    _initialize: function() {
        this.Ajaxloader.setup();
        var _self = this;
        $('#selectAllSat').click(function() {
            $('.sync_instance').each(function(key, obj) {
                $(obj).prop('checked', !0)
            })
        });
        $('#deselectAllSat').click(function() {
            $('.sync_instance').each(function(key, obj) {
                $(obj).prop('checked', !1)
            })
        });
        $('#saveInstacesForSync').click(function() {
            _self.saveInstacesForSync()
        });
        this.worker = function() {
            var self = this;
            $.ajax({
                url: '/exports/broadcast.json',
                cache: !1,
                type: "GET",
                success: function(response) {
                    var $exportLog = $('#exportLog');
                    for (var key in response.exportRecords) {
                        var $exportLogEntry = $exportLog.children('#' + key);
                        if ($exportLogEntry.length == 0) {
                            if (response.exportRecords[key].finished == 0) {
                                var html = '<div id="' + key + '" data-finished="0"><i class="fa fa-spin fa-refresh"></i> <span>' + response.exportRecords[key].text + '</span></div>'
                            } else {
                                if (response.exportRecords[key].successfully == 1) {
                                    var html = '<div id="' + key + '" data-finished="1"><i class="fa fa-check text-success"></i> <span>' + response.exportRecords[key].text + '</span></div>'
                                } else {
                                    var html = '<div id="' + key + '" data-finished="1"><i class="fa fa-times text-danger"></i> <span>' + response.exportRecords[key].text + '</span></div>'
                                }
                            }
                            $exportLog.append(html)
                        } else {
                            if (response.exportRecords[key].finished == 0) {
                                if ($exportLogEntry.data('finished') != 0) {
                                    var html = '<i class="fa fa-spin fa-refresh"></i> <span>' + response.exportRecords[key].text + '</span>';
                                    $exportLogEntry.html(html)
                                }
                            } else {
                                if (response.exportRecords[key].successfully == 1) {
                                    var html = '<i class="fa fa-check text-success"></i> <span>' + response.exportRecords[key].text + '</span>'
                                } else {
                                    var html = '<i class="fa fa-times text-danger"></i> <span>' + response.exportRecords[key].text + '</span>'
                                }
                                $exportLogEntry.html(html)
                            }
                        }
                    }
                    if (response.exportFinished.finished == !0) {
                        if (response.exportFinished.successfully == !0) {
                            $('#exportSuccessfully').show()
                        }
                        if (response.exportFinished.successfully == !1) {
                            $('#exportError').show();
                            for (var key in response.exportRecords) {
                                if (response.exportRecords[key].task == 'export_verify_new_configuration') {
                                    if (response.exportRecords[key].finished == 1 && response.exportRecords[key].successfully == 0) {
                                        self.verify()
                                    }
                                }
                            }
                        }
                    }
                },
                complete: function(response) {
                    if (response.responseJSON.exportFinished.finished == !1) {
                        setTimeout(self.worker, 1000)
                    }
                }
            })
        }.bind(this);
        if (this.getVar('exportRunning') == !0) {
            $('#exportInfo').show();
            this.worker()
        }
        $('#launchExport').click(function() {
            var self = this;
            $('#exportInfo').show();
            $('#launchExport').parents('.formactions').remove();
            var createBackup = 1;
            if ($('#CreateBackup').prop('checked') == !1 || $('#CreateBackup').prop('checked') == null) {
                createBackup = 0
            }
            var instacesToExport = [];
            $('.sync_instance').each(function(key, obj) {
                if ($(obj).prop('checked')) {
                    instacesToExport.push($(obj).attr('instance'))
                }
            });
            $.ajax({
                url: '/exports/launchExport/' + createBackup + '.json',
                cache: !1,
                type: "GET",
                data: {
                    instances: instacesToExport
                },
                success: function(response) {
                    if (response.export.exportRunning == !0) {
                        $('#exportRunning').show();
                        $('#exportInfo').show();
                        $('#launchExport').parents('.formactions').remove()
                    }
                    self.worker()
                },
                complete: function() {}
            })
        }.bind(this))
    },
    verify: function() {
        var $verifyOutput = $('#verifyOutput');
        var RegExObject = new RegExp('(' + this.getVar('uuidRegEx') + ')', 'g');
        $('#verifyError').show();
        $.ajax({
            url: '/exports/verifyConfig.json',
            cache: !1,
            type: "GET",
            success: function(response) {
                for (var key in response.result.output) {
                    var line = response.result.output[key];
                    line = line.replace(RegExObject, '<a href="/forward/index/uuid:$1/action:edit">$1</a>');
                    var _class = 'txt-color-blueDark';
                    if (line.match('Warning')) {
                        _class = 'txt-color-orangeDark'
                    }
                    if (line.match('Error')) {
                        _class = 'txt-color-red'
                    }
                    $verifyOutput.append('<div class="' + _class + '">' + line + '</div>')
                }
            },
            complete: function() {}
        })
    },
    saveInstacesForSync: function() {
        this.Ajaxloader.show();
        var instacesToExport = [];
        $('.sync_instance').each(function(key, obj) {
            if ($(obj).prop('checked')) {
                instacesToExport.push($(obj).attr('instance'))
            }
        });
        var self = this;
        $.ajax({
            url: '/exports/saveInstanceConfigSyncSelection.json',
            cache: !1,
            type: "GET",
            data: {
                instances: instacesToExport
            },
            success: function(response) {
                self.Ajaxloader.hide()
            },
            complete: function() {}
        })
    }
});
App.Controllers.TimeperiodsEditController = Frontend.AppController.extend({
    $table: null,
    timeperiodRow: 1,
    cloneCount: 1,
    _initialize: function() {
        var self = this;
        $('.addTimeRangeDivButton').click(function() {
            self.addTimeRangeFields();
            $this.parent().parent().trigger("liszt:updated")
        });
        this.bindEvents()
    },
    addTimeRangeFields: function() {
        var regex = /^(.*)(\d)+$/i;
        var index = $('.weekdays').length;
        $('#timerange_template').clone(!0, !0).removeClass('invisible template').attr('id', 'id' + index).attr('clone-number', index).insertBefore('#addTimerangeButton');
        $('#id' + index).find('input:text, select').each(function() {
            if (typeof $(this).attr('name') !== 'undefined') {
                $(this).attr('name', $(this).attr('name').replace(/\[template]*[[\d]*\]/, '[Timerange][' + index + ']'));
                if (typeof $(this).prop("type") !== 'undefined') {
                    if ($(this).prop("type") == 'select-one') {
                        $(this).chosen()
                    }
                }
            }
        })
    },
    bindEvents: function() {
        var self = this;
        $('.removeTimeRangeDivButton').click(function() {
            var $this = $(this);
            $this.parent().parent().remove()
        })
    },
});
App.Controllers.TimeperiodsAddController = Frontend.AppController.extend({
    $table: null,
    timeperiodRow: 1,
    cloneCount: 1,
    _initialize: function() {
        var self = this;
        $('.addTimeRangeDivButton').click(function() {
            self.addTimeRangeFields()
        });
        this.bindEvents()
    },
    addTimeRangeFields: function() {
        var regex = /^(.*)(\d)+$/i;
        var index = $('.weekdays').length;
        $('#timerange_template').clone(!0, !0).removeClass('invisible template').attr('id', 'id' + index).attr('clone-number', index).insertBefore('#addTimerangeButton');
        $('#id' + index).find('input:text, select').each(function() {
            if (typeof $(this).attr('name') !== 'undefined') {
                $(this).attr('name', $(this).attr('name').replace(/\[template]*[[\d]*\]/, '[Timerange][' + index + ']'));
                if (typeof $(this).prop("type") !== 'undefined') {
                    if ($(this).prop("type") == 'select-one') {
                        $(this).chosen()
                    }
                }
            }
        })
    },
    bindEvents: function() {
        var self = this;
        $('.removeTimeRangeDivButton').click(function() {
            var $this = $(this);
            $this.parent().parent().remove()
        })
    },
});
App.Controllers.TimeperiodsIndexController = Frontend.AppController.extend({
    $table: null,
    components: ['Masschange'],
    _initialize: function() {
        var self = this;
        this.Masschange.setup({
            'controller': 'timeperiods',
            'checkboxattr': 'timeperiodname',
            'useDeleteMessage': 'false'
        })
    }
});
App.Controllers.ServicedependenciesEditController = Frontend.AppController.extend({
    components: ['Ajaxloader', 'ContainerSelectbox'],
    _initialize: function() {
        var self = this;
        this.Ajaxloader.setup();
        this.ContainerSelectbox.setup(this.Ajaxloader);
        this.ContainerSelectbox.addContainerEventListener({
            selectBoxSelector: '#ServicedependencyContainerId',
            ajaxUrl: '/Servicedependencies/loadElementsByContainerId/:selectBoxValue:.json',
            optionGroupFieldTypes: {
                services: '#ServicedependencyService',
                servicesDependent: '#ServicedependencyServiceDependent'
            },
            fieldTypes: {
                servicegroups: '#ServicedependencyServicegroup',
                servicegroupsDependent: '#ServicedependencyServicegroupDependent',
                timeperiods: '#ServicedependencyTimeperiodId'
            },
            dataPlaceholderEmpty: self.getVar('data_placeholder_empty'),
            dataPlaceholder: self.getVar('data_placeholder')
        });
        $(document).on('click', '.group-result', function() {
            var unselected = $(this).nextUntil('.group-result').not('.result-selected');
            if (unselected.length) {
                unselected.trigger('mouseup')
            } else {
                $(this).nextUntil('.group-result').each(function() {
                    $('a.search-choice-close[data-option-array-index="' + $(this).data('option-array-index') + '"]').trigger('click')
                })
            }
        });
        $('[id^=ServicedependencyService]').change(function() {
            var $this = $(this);
            self.refreshServices($this.val(), $this, $this.attr('target'))
        });
        if ($('#ServicedependencyService').val() !== null || $('#ServicedependencyServiceDependent').val() !== null) {
            $('#ServicedependencyService').children().each(function(intKey, OptionObject) {
                if (in_array(OptionObject.value, $('#ServicedependencyServiceDependent').val())) {
                    $OptionObject = $(OptionObject);
                    $OptionObject.prop('disabled', !0)
                }
            });
            $('#ServicedependencyServiceDependent').children().each(function(intKey, OptionObject) {
                if (in_array(OptionObject.value, $('#ServicedependencyService').val())) {
                    $OptionObject = $(OptionObject);
                    $OptionObject.prop('disabled', !0)
                }
            });
            $('#ServicedependencyService').trigger("chosen:updated").change();
            $('#ServicedependencyServiceDependent').trigger("chosen:updated").change()
        }
        if ($('#ServicedependencyServicegroup').val() !== null || $('#ServicedependencyServicegroupDependent').val() !== null) {
            $('#ServicedependencyServicegroup').children().each(function(intKey, OptionObject) {
                if (in_array(OptionObject.value, $('#ServicedependencyServicegroupDependent').val())) {
                    $OptionObject = $(OptionObject);
                    $OptionObject.prop('disabled', !0)
                }
            });
            $('#ServicedependencyServicegroupDependent').children().each(function(intKey, OptionObject) {
                if (in_array(OptionObject.value, $('#ServicedependencyServicegroup').val())) {
                    $OptionObject = $(OptionObject);
                    $OptionObject.prop('disabled', !0)
                }
            });
            $('#ServicedependencyServicegroup').trigger("chosen:updated").change();
            $('#ServicedependencyServicegroupDependent').trigger("chosen:updated").change()
        }
    },
    refreshServices: function(selected_services, selectboxObject, target) {
        for (var key in selected_services) {
            $(target).find('option').each(function(intKey, OptionObject) {
                $OptionObject = $(OptionObject);
                if ($OptionObject.val() == selected_services[key]) {
                    if (!$OptionObject.prop('disabled')) {
                        $OptionObject.prop('disabled', !0)
                    }
                }
            })
        }
        var targetValue = $(target).val();
        $(target).find('option').each(function(intKey, OptionObject) {
            $OptionObject = $(OptionObject);
            if (targetValue == null) {
                targetValue = []
            }
            if (selected_services == null) {
                selected_services = []
            }
            if (!in_array($OptionObject.val(), selected_services) && !in_array($OptionObject.val(), targetValue)) {
                if ($OptionObject.prop('disabled')) {
                    $OptionObject.prop('disabled', null)
                }
            }
        });
        $(target).trigger("chosen:updated")
    }
});
App.Controllers.ServicedependenciesAddController = Frontend.AppController.extend({
    components: ['Ajaxloader', 'ContainerSelectbox'],
    _initialize: function() {
        var self = this;
        this.Ajaxloader.setup();
        this.ContainerSelectbox.setup(this.Ajaxloader);
        this.ContainerSelectbox.addContainerEventListener({
            selectBoxSelector: '#ServicedependencyContainerId',
            ajaxUrl: '/Servicedependencies/loadElementsByContainerId/:selectBoxValue:.json',
            optionGroupFieldTypes: {
                services: '#ServicedependencyService',
                servicesDependent: '#ServicedependencyServiceDependent'
            },
            fieldTypes: {
                servicegroups: '#ServicedependencyServicegroup',
                servicegroupsDependent: '#ServicedependencyServicegroupDependent',
                timeperiods: '#ServicedependencyTimeperiodId'
            },
            dataPlaceholderEmpty: self.getVar('data_placeholder_empty'),
            dataPlaceholder: self.getVar('data_placeholder')
        });
        $(document).on('click', '.group-result', function() {
            var unselected = $(this).nextUntil('.group-result').not('.result-selected');
            if (unselected.length) {
                unselected.trigger('mouseup')
            } else {
                $(this).nextUntil('.group-result').each(function() {
                    $('a.search-choice-close[data-option-array-index="' + $(this).data('option-array-index') + '"]').trigger('click')
                })
            }
        });
        $('[id^=ServicedependencyService]').change(function() {
            $this = $(this);
            self.refreshServices($this.val(), $this, $this.attr('target'))
        });
        if ($('#ServicedependencyService').val() !== null || $('#ServicedependencyServiceDependent').val() !== null) {
            $('#ServicedependencyService').children().each(function(intKey, OptionObject) {
                if (in_array(OptionObject.value, $('#ServicedependencyServiceDependent').val())) {
                    $OptionObject = $(OptionObject);
                    $OptionObject.prop('disabled', !0)
                }
            });
            $('#ServicedependencyServiceDependent').children().each(function(intKey, OptionObject) {
                if (in_array(OptionObject.value, $('#ServicedependencyService').val())) {
                    $OptionObject = $(OptionObject);
                    $OptionObject.prop('disabled', !0)
                }
            });
            $('#ServicedependencyService').trigger("chosen:updated").change();
            $('#ServicedependencyServiceDependent').trigger("chosen:updated").change()
        }
        if ($('#ServicedependencyServicegroup').val() !== null || $('#ServicedependencyServicegroupDependent').val() !== null) {
            $('#ServicedependencyServicegroup').children().each(function(intKey, OptionObject) {
                if (in_array(OptionObject.value, $('#ServicedependencyServicegroupDependent').val())) {
                    $OptionObject = $(OptionObject);
                    $OptionObject.prop('disabled', !0)
                }
            });
            $('#ServicedependencyServicegroupDependent').children().each(function(intKey, OptionObject) {
                if (in_array(OptionObject.value, $('#ServicedependencyServicegroup').val())) {
                    $OptionObject = $(OptionObject);
                    $OptionObject.prop('disabled', !0)
                }
            });
            $('#ServicedependencyServicegroup').trigger("chosen:updated").change();
            $('#ServicedependencyServicegroupDependent').trigger("chosen:updated").change()
        }
    },
    refreshServices: function(selected_services, selectboxObject, target) {
        for (var key in selected_services) {
            $(target).find('option').each(function(intKey, OptionObject) {
                $OptionObject = $(OptionObject);
                if ($OptionObject.val() == selected_services[key]) {
                    if (!$OptionObject.prop('disabled')) {
                        $OptionObject.prop('disabled', !0)
                    }
                }
            })
        }
        var targetValue = $(target).val();
        $(target).find('option').each(function(intKey, OptionObject) {
            $OptionObject = $(OptionObject);
            if (targetValue == null) {
                targetValue = []
            }
            if (selected_services == null) {
                selected_services = []
            }
            if (!in_array($OptionObject.val(), selected_services) && !in_array($OptionObject.val(), targetValue)) {
                if ($OptionObject.prop('disabled')) {
                    $OptionObject.prop('disabled', null)
                }
            }
        });
        $(target).trigger("chosen:updated")
    }
});
App.Controllers.UsersAddController = Frontend.AppController.extend({
    _initialize: function() {
        var self = this;
        var $userContainer = $('#UserContainer');
        if (self.getVar('rights') !== null) {
            $('#rightLevels').removeClass('hidden');
            $.each(self.getVar('rights'), function(index, value) {
                self.addRightLevel(index, value)
            })
        }
        $userContainer.change(function(evt, params) {
            if ($userContainer.val() !== null) {
                $('#rightLevels').removeClass('hidden')
            } else {
                $('#rightLevels').addClass('hidden')
            }
            if (params.selected) {
                self.addRightLevel(params.selected, 1)
            } else if (params.deselected) {
                self.removeRightLevel(params.deselected)
            }
        })
    },
    addRightLevel: function(selectedOptionValue, level) {
        var label = $("#UserContainer option[value='" + selectedOptionValue + "']").text();
        var disabled = !1;
        if (label === '/root') {
            disabled = !0;
            level = 2
        }
        var $rightRadios = $('<fieldset id="' + selectedOptionValue + '"></fieldset>').prepend($('<legend class="no-padding font-sm text-primary">' + label + '</legend>'), $('<input />').attr({
            'type': 'radio',
            'name': 'data[ContainerUserMembership][' + selectedOptionValue + ']',
            'value': '1',
            'checked': (level & 1) ? !0 : !1,
            'id': 'read-' + selectedOptionValue,
            'disabled': disabled
        }), $('<label />').attr({
            'for': 'read-' + selectedOptionValue,
            'class': 'padding-10 font-sm'
        }).text('read'), $('<input />').attr({
            'type': 'radio',
            'name': 'data[ContainerUserMembership][' + selectedOptionValue + ']',
            'value': '2',
            'checked': (level & 2) ? !0 : !1,
            'id': 'write-' + selectedOptionValue
        }), $('<label />').attr({
            'for': 'write-' + selectedOptionValue,
            'class': 'padding-10 font-sm'
        }).text('read/write'));
        $('#rightLevels').append($rightRadios).trigger('create')
    },
    removeRightLevel: function(deSelectedOptionValue) {
        $('#' + deSelectedOptionValue).remove()
    }
});
App.Controllers.UsersEditController = Frontend.AppController.extend({
    _initialize: function() {
        var self = this;
        var $userContainer = $('#UserContainer');
        if (self.getVar('rights') !== null) {
            $('#rightLevels').removeClass('hidden');
            $.each(self.getVar('rights'), function(index, value) {
                self.addRightLevel(index, value)
            })
        }
        $userContainer.change(function(evt, params) {
            if ($userContainer.val() !== null) {
                $('#rightLevels').removeClass('hidden')
            } else {
                $('#rightLevels').addClass('hidden')
            }
            if (params.selected) {
                self.addRightLevel(params.selected, 1)
            } else if (params.deselected) {
                self.removeRightLevel(params.deselected)
            }
        })
    },
    addRightLevel: function(selectedOptionValue, level) {
        var label = $("#UserContainer option[value='" + selectedOptionValue + "']").text();
        var disabled = !1;
        if (label === '/root') {
            disabled = !0;
            level = 2
        }
        var $rightRadios = $('<fieldset id="' + selectedOptionValue + '"></fieldset>').prepend($('<legend class="no-padding font-sm text-primary">' + label + '</legend>'), $('<input />').attr({
            'type': 'radio',
            'name': 'data[ContainerUserMembership][' + selectedOptionValue + ']',
            'value': '1',
            'checked': (level & 1) ? !0 : !1,
            'id': 'read-' + selectedOptionValue,
            'disabled': disabled
        }), $('<label />').attr({
            'for': 'read-' + selectedOptionValue,
            'class': 'padding-10 font-sm'
        }).text('read'), $('<input />').attr({
            'type': 'radio',
            'name': 'data[ContainerUserMembership][' + selectedOptionValue + ']',
            'value': '2',
            'checked': (level & 2) ? !0 : !1,
            'id': 'write-' + selectedOptionValue
        }), $('<label />').attr({
            'for': 'write-' + selectedOptionValue,
            'class': 'padding-10 font-sm'
        }).text('read/write'));
        $('#rightLevels').append($rightRadios).trigger('create')
    },
    removeRightLevel: function(deSelectedOptionValue) {
        $('#' + deSelectedOptionValue).remove()
    }
});
App.Controllers.ServicetemplategroupsAddController = Frontend.AppController.extend({
    components: ['Ajaxloader'],
    _initialize: function() {
        this.Ajaxloader.setup();
        var self = this;
        $('#ContainerParentId').change(function() {
            self.Ajaxloader.show();
            $.ajax({
                url: "/servicetemplategroups/loadServicetemplatesByContainerId/" + encodeURIComponent($(this).val()) + ".json",
                type: "POST",
                cache: !1,
                error: function() {},
                success: function() {},
                complete: function(response) {
                    var $selectServicetemplates = $('#ServicetemplategroupServicetemplate');
                    $selectServicetemplates.html('');
                    $selectServicetemplates.attr('data-placeholder', self.getVar('data_placeholder_empty'));
                    for (var key in response.responseJSON.servicetemplates) {
                        if (Object.keys(response.responseJSON.servicetemplates).length > 0) {
                            $selectServicetemplates.attr('data-placeholder', self.getVar('data_placeholder'));
                            $selectServicetemplates.append('<option value="' + response.responseJSON.servicetemplates[key].key + '">' + response.responseJSON.servicetemplates[key].value + '</option>')
                        }
                    }
                    $selectServicetemplates.trigger("chosen:updated");
                    self.Ajaxloader.hide()
                }.bind(self)
            })
        })
    }
});
App.Controllers.ServicetemplategroupsAllocateToHostController = Frontend.AppController.extend({
    components: ['Ajaxloader'],
    _initialize: function() {
        this.Ajaxloader.setup();
        var self = this;
        $('#ServiceHostId').change(function() {
            self.enableAll();
            self.hideAllDuplicate();
            self.hideAllDuplicateDisabled();
            self.Ajaxloader.show();
            $.ajax({
                url: "/hosts/getHostByAjax/" + encodeURIComponent($(this).val()) + ".json",
                type: "POST",
                cache: !1,
                error: function() {},
                success: function() {},
                complete: function(response) {
                    self.Ajaxloader.hide();
                    $(response.responseJSON.host.Service).each(function(intKey, serviceObject) {
                        $('#servicetemplate_' + serviceObject.servicetemplate_id).prop('checked', null);
                        if ($('#servicetemplate_' + serviceObject.servicetemplate_id).prop('checked') === !1) {
                            if (serviceObject.disabled == 1 || serviceObject.disabled == '1') {
                                $('#duplicateDisabled_' + serviceObject.servicetemplate_id).show()
                            }
                            $('#duplicate_' + serviceObject.servicetemplate_id).show()
                        }
                    })
                }.bind(self)
            })
        })
    },
    enableAll: function() {
        $('.createThisService').prop('checked', !0)
    },
    disableAll: function() {
        $('.createThisService').prop('checked', null)
    },
    hideAllDuplicate: function() {
        $('.createServiceDuplicate').hide()
    },
    hideAllDuplicateDisabled: function() {
        $('.createServiceDuplicateDisabled').hide()
    }
});
App.Controllers.ServicetemplategroupsEditController = Frontend.AppController.extend({
    components: ['Ajaxloader'],
    _initialize: function() {
        this.Ajaxloader.setup();
        var self = this;
        $('#ContainerParentId').change(function() {
            self.Ajaxloader.show();
            $.ajax({
                url: "/servicetemplategroups/loadServicetemplatesByContainerId/" + encodeURIComponent($(this).val()) + ".json",
                type: "POST",
                cache: !1,
                error: function() {},
                success: function() {},
                complete: function(response) {
                    var $selectServicetemplates = $('#ServicetemplategroupServicetemplate');
                    $selectServicetemplates.html('');
                    $selectServicetemplates.attr('data-placeholder', self.getVar('data_placeholder_empty'));
                    for (var key in response.responseJSON.servicetemplates) {
                        if (Object.keys(response.responseJSON.servicetemplates).length > 0) {
                            $selectServicetemplates.attr('data-placeholder', self.getVar('data_placeholder'));
                            $selectServicetemplates.append('<option value="' + response.responseJSON.servicetemplates[key].key + '">' + response.responseJSON.servicetemplates[key].value + '</option>')
                        }
                    }
                    $selectServicetemplates.trigger("chosen:updated");
                    self.Ajaxloader.hide()
                }.bind(self)
            })
        })
    }
});
App.Controllers.ServicetemplategroupsAllocateToHostgroupController = Frontend.AppController.extend({
    components: ['Ajaxloader'],
    _initialize: function() {
        this.Ajaxloader.setup();
        var self = this;
        $('#HostgroupId').change(function() {
            self.Ajaxloader.show();
            $.ajax({
                url: "/servicetemplategroups/getHostsByHostgroupByAjax/" + encodeURIComponent($(this).val()) + "/" + self.getVar('servicetemplategroup_id') + ".json",
                type: "POST",
                cache: !1,
                error: function() {},
                success: function() {},
                complete: function(response) {
                    self.Ajaxloader.hide();
                    $('#ajaxContent').html('');
                    $(response.responseJSON.hosts).each(function(intKey, hostObject) {
                        var html = '';
                        html += '<fieldset><legend><i class="fa fa-desktop"></i> ' + htmlspecialchars(hostObject.Host.name) + '</legend>';
                        $(response.responseJSON.servicetemplategroup.Servicetemplate).each(function(_intKey, servicetemplateObject) {
                            var exists = !1;
                            var disabled = !1;
                            $(hostObject.Service).each(function(__intKey, serviceObject) {
                                if (serviceObject.servicetemplate_id == servicetemplateObject.id) {
                                    exists = !0;
                                    if (serviceObject.disabled == 1 || serviceObject.disabled == '1') {
                                        disabled = !0
                                    }
                                }
                            });
                            var checked = '';
                            if (exists === !1 && disabled === !1) {
                                checked = 'checked="checked"'
                            }
                            html += '<div class="padding-left-10 padding-bottom-5">';
                            html += '<input type="checkbox" ' + checked + ' id="servicetemplate_' + servicetemplateObject.id + '_' + hostObject.Host.id + '" value="' + servicetemplateObject.id + '" name="data[Host][' + hostObject.Host.id + '][ServicesToAdd][]" />';
                            html += '<label for="servicetemplate_' + servicetemplateObject.id + '_' + hostObject.Host.id + '">' + htmlspecialchars(servicetemplateObject.name) + ' <i class="text-info">(' + htmlspecialchars(servicetemplateObject.description) + ')</i></label>';
                            if (exists === !0) {
                                html += '<a href="javascript:void(0);" data-original-title="' + self.getVar('service_exists') + '" data-placement="right" rel="tooltip" data-container="body"><i class="padding-left-5 fa fa-info-circle text-info"></i></a>'
                            }
                            if (disabled === !0) {
                                html += '<a class="txt-color-blueDark" href="javascript:void(0);" data-original-title="' + self.getVar('service_disabled') + '" data-placement="right" rel="tooltip" data-container="body"><i class="padding-left-5 fa fa-plug"></i></a>'
                            }
                            html += '</div>'
                        });
                        html += '</fieldset>';
                        $('#ajaxContent').append(html);
                        $('[rel="tooltip"]').tooltip()
                    })
                }.bind(self)
            })
        })
    }
});
App.Controllers.LocationsAddController = Frontend.AppController.extend({
    latitude: null,
    longitude: null,
    $map: null,
    $mapDiv: null,
    _initialize: function() {
        this.$mapDiv = $('#mapDiv');
        $('#LocationLatitude').keyup(function() {
            var locationLatitudeValue = $(this).val().replace(/,/gi, '.').replace(/[^\d.-]/g, '');
            $(this).val(locationLatitudeValue)
        });
        $('#LocationLongitude').keyup(function() {
            var locationLongitudeValue = $(this).val().replace(/,/gi, '.').replace(/[^\d.-]/g, '');
            $(this).val(locationLongitudeValue)
        });
        $('#LocationLatitude').change(function() {
            this.setMarker()
        }.bind(this));
        $('#LocationLongitude').change(function() {
            this.setMarker()
        }.bind(this));
        this.$mapDiv.vectorMap({
            map: 'world_mill_en',
            backgroundColor: '#fff',
            regionStyle: {
                initial: {
                    fill: '#c4c4c4'
                },
                hover: {
                    'hoverColor': '#4C4C4C'
                }
            },
            markerStyle: {
                initial: {
                    fill: '#800000',
                    stroke: '#383f47'
                }
            },
        });
        this.$map = this.$mapDiv.vectorMap('get', 'mapObject')
    },
    setMarker: function() {
        if (!$('#LocationLatitude').val() || !$('#LocationLongitude').val()) {
            return
        }
        this.latitude = $('#LocationLatitude').val();
        this.longitude = $('#LocationLongitude').val();
        if ((this.latitude > -505 && this.latitude < 533) && (this.longitude > -168 && this.longitude < 191)) {
            $('#LatitudeRangeError').hide();
            $('#locationPonts').removeClass('has-error');
            this.$map.removeAllMarkers();
            this.$map.reset();
            this.$map.addMarker('markerIndex', {
                latLng: [this.latitude, this.longitude]
            });
            var points = this.$map.latLngToPoint(this.latitude, this.longitude);
            var map_x = points.x / this.$mapDiv.width();
            var map_y = points.y / this.$mapDiv.height();
            this.$map.setFocus(4, map_x, map_y)
        } else {
            $('#LatitudeRangeError').show();
            $('#locationPonts').addClass('has-error')
        }
    }
});
App.Controllers.LocationsEditController = Frontend.AppController.extend({
    latitude: null,
    longitude: null,
    $map: null,
    $mapDiv: null,
    _initialize: function() {
        this.$mapDiv = $('#mapDiv');
        $('#LocationLatitude').keyup(function() {
            var locationLatitudeValue = $(this).val().replace(/,/gi, '.').replace(/[^\d.-]/g, '');
            $(this).val(locationLatitudeValue)
        });
        $('#LocationLongitude').keyup(function() {
            var locationLongitudeValue = $(this).val().replace(/,/gi, '.').replace(/[^\d.-]/g, '');
            $(this).val(locationLongitudeValue)
        });
        $('#LocationLatitude').change(function() {
            this.setMarker()
        }.bind(this));
        $('#LocationLongitude').change(function() {
            this.setMarker()
        }.bind(this));
        this.$mapDiv.vectorMap({
            map: 'world_mill_en',
            backgroundColor: '#fff',
            regionStyle: {
                initial: {
                    fill: '#c4c4c4'
                },
                hover: {
                    'hoverColor': '#4C4C4C'
                }
            },
            markers: [{
                latLng: [this.getVar('latitude'), this.getVar('longitude')]
            }, ],
            markerStyle: {
                initial: {
                    fill: '#800000',
                    stroke: '#383f47'
                }
            },
        });
        this.$map = this.$mapDiv.vectorMap('get', 'mapObject');
        this.setFocus(this.getVar('latitude'), this.getVar('longitude'))
    },
    setMarker: function() {
        this.latitude = $('#LocationLatitude').val();
        this.latitude = parseFloat(this.latitude.replace(",", "."));
        this.longitude = $('#LocationLongitude').val();
        this.longitude = parseFloat(this.longitude.replace(",", "."));
        $('#LocationLatitude').val(this.latitude);
        $('#LocationLongitude').val(this.longitude);
        if ((this.latitude > -505 && this.latitude < 533) && (this.longitude > -168 && this.longitude < 191)) {
            $('#LatitudeRangeError').hide();
            this.$map.removeAllMarkers();
            this.$map.reset();
            this.$map.addMarker('markerIndex', {
                latLng: [this.latitude, this.longitude]
            });
            this.setFocus(this.latitude, this.longitude)
        } else {
            $('#LatitudeRangeError').show()
        }
    },
    setFocus: function(latitude, longitude) {
        this.$map.reset();
        var points = this.$map.latLngToPoint(latitude, longitude);
        var map_x = points.x / this.$mapDiv.width();
        var map_y = points.y / this.$mapDiv.height();
        this.$map.setFocus(10, map_x, map_y)
    }
});
App.Controllers.UsergroupsAddController = Frontend.AppController.extend({
    components: ['Ajaxloader', 'Aco'],
    _initialize: function() {
        var self = this;
        this.Ajaxloader.setup();
        this.Aco.setup()
    },
});
App.Controllers.UsergroupsEditController = Frontend.AppController.extend({
    components: ['Ajaxloader', 'Aco'],
    _initialize: function() {
        var self = this;
        this.Ajaxloader.setup();
        this.Aco.setup()
    },
});
App.Controllers.CronjobsAddController = Frontend.AppController.extend({
    components: ['Ajaxloader'],
    _initialize: function() {
        this.Ajaxloader.setup();
        var self = this;
        $('#CronjobPlugin').change(function() {
            var $this = $(this);
            var $taskSelect = $('#CronjobTask');
            self.Ajaxloader.show();
            var _this = self;
            $.ajax({
                url: "/cronjobs/loadTasksByPlugin/" + encodeURIComponent($this.val()) + '.json',
                type: "GET",
                cache: !1,
                error: function() {},
                success: function() {},
                complete: function(response) {
                    $taskSelect.html('');
                    for (var key in response.responseJSON.tasks) {
                        $taskSelect.append('<option value="' + response.responseJSON.tasks[key] + '">' + response.responseJSON.tasks[key] + '</option>')
                    }
                    _this.Ajaxloader.hide()
                }
            })
        })
    }
});
App.Controllers.CronjobsEditController = Frontend.AppController.extend({
    components: ['Ajaxloader'],
    _initialize: function() {
        this.Ajaxloader.setup();
        var self = this;
        $('#CronjobPlugin').change(function() {
            var $this = $(this);
            var $taskSelect = $('#CronjobTask');
            self.Ajaxloader.show();
            var _this = self;
            $.ajax({
                url: "/cronjobs/loadTasksByPlugin/" + encodeURIComponent($this.val()) + '.json',
                type: "GET",
                cache: !1,
                error: function() {},
                success: function() {},
                complete: function(response) {
                    $taskSelect.html('');
                    for (var key in response.responseJSON.tasks) {
                        $taskSelect.append('<option value="' + response.responseJSON.tasks[key] + '">' + response.responseJSON.tasks[key] + '</option>')
                    }
                    _this.Ajaxloader.hide()
                }
            })
        })
    }
});
App.Controllers.GraphgeneratorsViewController = Frontend.AppController.extend({
    host_uuid: null,
    host_name: '',
    service_uuid: null,
    service_name: '',
    currently_loaded_service_rules: {},
    user_default_timeout: 2000,
    debug: !1,
    _service_rules_timeout_id: 0,
    _service_rules_remove_timeout_id: 0,
    components: ['Ajaxloader', 'Rrd', 'BootstrapModal', 'Overlay', 'Time'],
    _initialize: function() {
        this.Ajaxloader.setup();
        this.Time.setup();
        this.BootstrapModal.setup({
            content: window.bootstrapModalContent,
            on_close: function() {
                $('#saveGraph').prop('disabled', !1)
            }
        });
        this.Overlay.setup({
            $ui: $('#widget-grid')
        });
        this.$services_select_box = $('#GraphgeneratorServiceUuid');
        this.bindChangeEventForServiceRules();
        this.initValidation();
        $('#content').css({
            'backgroundColor': 'white'
        });
        this.renderGraphConfiguration(window.App.loaded_graph_config);
        setTimeout(function() {
            location.reload(!0)
        }, 90000)
    },
    renderGraphConfiguration: function(config) {
        if (Object.keys(config).length == 0) {
            if (this.debug) {
                console.info('No configuration found to load')
            }
            return
        }
        config = config.HostAndServices;
        for (var host_id in config) {
            for (var service_id in config[host_id].services) {
                var host_uuid = config[host_id].host_uuid,
                    host_name = config[host_id].host_name,
                    service_uuid = config[host_id].services[service_id].service_uuid,
                    service_name = config[host_id].services[service_id].service_name,
                    data_sources = config[host_id].services[service_id].data_sources,
                    host = {
                        id: host_id,
                        uuid: host_uuid,
                        name: host_name
                    },
                    service = {
                        id: service_id,
                        uuid: service_uuid,
                        name: service_name
                    },
                    onComplete = function() {
                        for (var i in data_sources) {
                            var ds = data_sources[i],
                                $obj = $('#AjaxServicerule_' + service_uuid + '_' + ds);
                            if ($obj.length == 0) {
                                return
                            }
                            $obj.prop('checked', !0).trigger('change')
                        }
                    };
                this._loadServiceRule(host, service, onComplete)
            }
        }
    },
    initValidation: function() {
        $.validator.addMethod('custom_datetime', function(value, element) {
            var matches = value.match(/^(\d{2})\.(\d{2})\.(\d{4}) (\d{2}):(\d{2}):(\d{2})$/);
            if (matches === null) {
                return !1
            } else {
                var year = parseInt(matches[3], 10);
                var month = parseInt(matches[2], 10) - 1;
                var day = parseInt(matches[1], 10);
                var hour = parseInt(matches[4], 10);
                var minute = parseInt(matches[5], 10);
                var second = parseInt(matches[6], 10);
                var date = new Date(year, month, day, hour, minute, second);
                return !(date.getFullYear() !== year || date.getMonth() != month || date.getDate() !== day || date.getHours() !== hour || date.getMinutes() !== minute || date.getSeconds() !== second)
            }
        }, 'Please enter a valid date and time.');
        $('#GraphgeneratorIndexForm').validate({
            rules: {
                'data[Graphgenerator][name]': {
                    required: !0,
                    minlength: 3
                },
                'data[Graphgenerator][time]': {
                    required: !0,
                    minlength: 3
                }
            },
            messages: {},
            errorPlacement: function($error, $element) {
                var $icon = $('<i>', {
                        class: 'fa fa-exclamation-triangle',
                        'data-toggle': 'tooltip',
                        'data-placement': 'right',
                        title: $error.text()
                    }).css({
                        'font-size': '22px',
                        color: '#a11b1b',
                        padding: '0 5px',
                        transition: 'all 2'
                    }),
                    $warning = $('<div>', {
                        class: 'icon-warning input-group-btn'
                    }).css({
                        'transition': 'all 2s'
                    }).append($icon);
                $icon.tooltip();
                var $parent = $element.parent('.input-group');
                var $icon_warning = $parent.find('.icon-warning');
                if ($icon_warning.length) {
                    $icon_warning.find('.fa').tooltip('destroy');
                    $icon_warning.remove()
                }
                $parent.append($warning);
                $icon.show();
                return !0
            },
            highlight: function(element) {
                $(element).parents('.input-group').removeClass('has-success').addClass('has-error')
            },
            unhighlight: function(element) {
                var $parent = $(element).parents('.input-group');
                $parent.removeClass('has-error').addClass('has-success');
                $parent.find('.icon-warning').html('')
            }
        })
    },
    getCurrentServiceRulesForSave: function() {
        var service_rules = {};
        $('.servicerule_control').each(function(index, checkbox) {
            var $checkbox = $(checkbox);
            if ($checkbox.length == 0 || $checkbox.prop('checked') == !1) {
                return
            }
            var ds_number = $checkbox.val(),
                service_id = $checkbox.data('service-id'),
                host_uuid = $checkbox.data('host-uuid');
            if (typeof service_rules[host_uuid] !== 'object') {
                service_rules[host_uuid] = {}
            }
            if (typeof service_rules[host_uuid][service_id] !== 'object') {
                service_rules[host_uuid][service_id] = []
            }
            service_rules[host_uuid][service_id].push(ds_number)
        });
        return service_rules
    },
    getCurrentServiceRules: function() {
        var service_rules = {};
        $('.servicerule_control').each(function(index, checkbox) {
            var $checkbox = $(checkbox);
            if ($checkbox.length == 0 || $checkbox.prop('checked') == !1) {
                return
            }
            var ds_number = $checkbox.val(),
                service_rule_name = $checkbox.data('service-rule-name'),
                service_id = $checkbox.data('service-id'),
                service_name = $checkbox.data('service-name'),
                service_uuid = $checkbox.data('service-uuid'),
                host_uuid = $checkbox.data('host-uuid'),
                host_name = $checkbox.data('host-name');
            if (typeof service_rules[host_uuid] !== 'object') {
                service_rules[host_uuid] = {}
            }
            if (typeof service_rules[host_uuid][service_uuid] !== 'object') {
                service_rules[host_uuid][service_uuid] = {}
            }
            if (typeof service_rules[host_uuid][service_uuid][ds_number] !== 'object') {
                service_rules[host_uuid][service_uuid][ds_number] = {}
            }
            service_rules[host_uuid][service_uuid][ds_number].service_id = service_id;
            service_rules[host_uuid][service_uuid][ds_number].service_name = service_name;
            service_rules[host_uuid][service_uuid][ds_number].service_rule_name = service_rule_name;
            service_rules[host_uuid][service_uuid][ds_number].host_name = host_name
        });
        return service_rules
    },
    xhrRequestData: function(url, on_complete, data, options) {
        data = (data == null ? {} : data);
        options = (options == null ? {} : options);
        var self = this,
            defaults = {
                url: url,
                type: 'post',
                cache: !1,
                data: data,
                dataType: 'json',
                error: function() {},
                success: function() {},
                complete: function(response) {
                    on_complete(response);
                    self.Ajaxloader.hide()
                }
            };
        $.extend(defaults, options);
        self.Ajaxloader.show();
        $.ajax(defaults)
    },
    _loadServicesByHostId: function(host_id, on_complete) {
        on_complete = typeof on_complete == 'function' ? on_complete : function() {};
        var url = '/Graphgenerators/loadServicesByHostId/' + parseInt(host_id, 10) + '.json',
            self = this;
        self.xhrRequestData(url, on_complete)
    },
    _loadServiceRule: function(host, service, on_complete) {
        on_complete = typeof on_complete == 'function' ? on_complete : function() {};
        var self = this,
            url = '/Graphgenerators/loadServiceruleFromService/' + encodeURIComponent(host.uuid) + '/' + encodeURIComponent(service.uuid) + '.json',
            $target = $('#serviceRules'),
            on_complete_xhr = function(response) {
                if (!response.responseJSON || response.responseJSON.sizeof <= 0)
                    return;
                var response_json = response.responseJSON,
                    perfdata_structure = response_json.perfdataStructure,
                    $chosen_div;
                $chosen_div = self._addServiceRuleEntry(perfdata_structure, host, service);
                $target.append($chosen_div);
                $chosen_div.slideDown('fast');
                if (typeof self.currently_loaded_service_rules[host.id] != 'object') {
                    self.currently_loaded_service_rules[host.id] = {}
                }
                self.currently_loaded_service_rules[host.id][service.uuid] = !0;
                on_complete($chosen_div)
            };
        if (service.uuid != '0') {
            self.xhrRequestData(url, on_complete_xhr, {}, {
                async: !1
            })
        }
    },
    _addServiceRuleEntry: function(perfdata_structure, host, service) {
        var self = this,
            rows = [],
            key, $chosen_div = $('<div>', {
                class: 'chosen-service',
                style: 'display: none'
            }),
            $titleRowDiv = $('<div>', {
                class: 'row title-row'
            }),
            $title_host_name = $('<span>', {
                text: host.name,
                class: 'col-md-5 title',
                style: 'overflow: hidden'
            }),
            $title_service_name = $('<span>', {
                text: service.name,
                class: 'col-md-5 title',
                style: 'overflow: hidden'
            }),
            $removeIcon = $('<a>', {
                class: 'glyphicon glyphicon-remove',
                title: 'Remove this service',
                css: {
                    cursor: 'pointer',
                    'text-decoration': 'none'
                },
                click: function() {
                    var $this = $(this),
                        $chosen_service = $this.parents('.chosen-service'),
                        $service_rule = $chosen_service.find('input.servicerule_control'),
                        host_uuid = $service_rule.data('host-uuid'),
                        service_uuid = $service_rule.data('service-uuid');
                    self.currently_loaded_service_rules[self.host_id][service_uuid] = !1;
                    $chosen_service.slideUp('fast', function() {
                        $(this).remove();
                        if (self._service_rules_timeout_id != 0) {
                            clearTimeout(self._service_rules_timeout_id)
                        }
                        self._service_rules_timeout_id = setTimeout(function() {
                            var time_period = self.getConfiguredTimePeriod(),
                                service_rules = self.getCurrentServiceRules();
                            if (Object.keys(service_rules).length == 0) {
                                self.Rrd.resetGraph();
                                $('.graph_legend').hide()
                            } else {
                                self.Overlay.deactivateUi();
                                self.Rrd.drawServiceRules(service_rules, time_period, function() {
                                    self.Overlay.activateUi()
                                })
                            }
                            self._updateServicesSelectBox()
                        }, self.user_default_timeout)
                    })
                }
            });
        for (key in perfdata_structure) {
            var current_object = perfdata_structure[key],
                ds = current_object.ds,
                name = current_object.name,
                unit = current_object.unit,
                $row = $('<div>', {
                    'class': 'row'
                }),
                $ajax_service_rule_label = $('<label>', {
                    'class': 'col col-md-6 control-label text-left',
                    'text': name + ' (' + unit + ')'
                }),
                $switch_span = $('<span>', {
                    'class': 'onoffswitch'
                }),
                $checkbox_input = $('<input>', {
                    type: 'checkbox',
                    class: 'onoffswitch-checkbox servicerule_control',
                    id: 'AjaxServicerule_' + service.uuid + '_' + ds,
                    value: ds,
                    data: {
                        'service-rule-name': name,
                        'service-uuid': service.uuid,
                        'service-name': service.name,
                        'service-id': service.id,
                        'host-uuid': host.uuid,
                        'host-name': host.name
                    }
                }),
                $label = $('<label>', {
                    'for': 'AjaxServicerule_' + service.uuid + '_' + ds,
                    'class': 'onoffswitch-label'
                }),
                $span = $('<span>', {
                    'data-swchon-text': name,
                    'data-swchoff-text': name,
                    'class': 'onoffswitch-inner'
                }),
                $other_span = $('<span>', {
                    'class': 'onoffswitch-switch'
                });
            $label.append($span).append($other_span);
            $switch_span.append($checkbox_input).append($label);
            $row.append($ajax_service_rule_label).append($switch_span);
            rows.push($row)
        }
        $titleRowDiv.append($title_host_name);
        $titleRowDiv.append($title_service_name);
        $titleRowDiv.append('&nbsp;');
        $titleRowDiv.append($removeIcon);
        $chosen_div.append($titleRowDiv);
        $.fn.append.apply($chosen_div, rows);
        return $chosen_div
    },
    bindChangeEventForServiceRules: function() {
        var self = this;
        $(document).on('change', '.servicerule_control', function() {
            if (self._service_rules_timeout_id != 0) {
                clearTimeout(self._service_rules_timeout_id);
                self._service_rules_timeout_id = 0
            }
            self._service_rules_timeout_id = setTimeout(function() {
                self.Ajaxloader.show();
                self._updateGraphByServiceRules();
                clearTimeout(self._service_rules_timeout_id);
                self._service_rules_timeout_id = 0
            }, self.user_default_timeout)
        })
    },
    _updateGraphByServiceRules: function() {
        var self = this,
            service_rules = self.getCurrentServiceRules(),
            time_period = self.getConfiguredTimePeriod(),
            host_and_service_uuids = {},
            service_uuid, host_uuid;
        if (Object.keys(service_rules).length == 0) {
            self.Ajaxloader.hide();
            return
        }
        for (host_uuid in service_rules) {
            if (typeof host_and_service_uuids[host_uuid] !== 'object') {
                host_and_service_uuids[host_uuid] = []
            }
            for (service_uuid in service_rules[host_uuid]) {
                host_and_service_uuids[host_uuid].push(service_uuid)
            }
        }
        self.Overlay.deactivateUi();
        self.Rrd.setup({
            url: '/Graphgenerators/fetchGraphData/.json',
            host_and_service_uuids: host_and_service_uuids,
            selector: '#graph',
            height: '350px',
            timezoneOffset: this.Time.timezoneOffset,
            timeout_in_ms: self.user_default_timeout,
            error_callback: function(response, status) {
                self.Overlay.activateUi();
                self.BootstrapModal.show('request-took-to-long')
            },
            update_plot: function(event, plot, action) {
                var axes = plot.getAxes(),
                    min = axes.xaxis.min.toFixed(2),
                    max = axes.xaxis.max.toFixed(2),
                    start_timestamp = parseInt(min, 10),
                    end_timestamp = parseInt(max, 10),
                    start_date = new Date(parseInt(min, 10)),
                    end_date = new Date(parseInt(max, 10)),
                    formatted_start_date = sprintf('%d.%d.%d %02d:%02d:%02d', start_date.getDate(), start_date.getMonth() + 1, start_date.getFullYear(), start_date.getHours(), start_date.getMinutes(), start_date.getSeconds()),
                    formatted_end_date = sprintf('%d.%d.%d %02d:%02d:%02d', end_date.getDate(), end_date.getMonth() + 1, end_date.getFullYear(), end_date.getHours(), end_date.getMinutes(), end_date.getSeconds()),
                    time_range = {
                        start: start_timestamp,
                        end: end_timestamp
                    },
                    update_plot_this = this;
                if (self._service_rules_timeout_id > 0) {
                    clearTimeout(self._service_rules_timeout_id);
                    self._service_rules_timeout_id = 0
                }
                self._service_rules_timeout_id = setTimeout(function() {
                    self.Overlay.deactivateUi();
                    $('#GraphgeneratorStart').val(formatted_start_date);
                    $('#GraphgeneratorEnd').val(formatted_end_date);
                    update_plot_this.drawServiceRules(self.getCurrentServiceRules(), time_range, function() {
                        self.Overlay.activateUi()
                    })
                }, self.user_default_timeout)
            }
        });
        self.Rrd.drawServiceRules(service_rules, time_period, function() {
            $('.graph_legend').show();
            self.Ajaxloader.hide();
            self.Overlay.activateUi()
        });
        $('#resetGraph').show()
    },
    getConfiguredTimePeriod: function() {
        var now = parseInt(this.Time.getCurrentTimeWithOffset(0).getTime() / 1000, 10),
            timeframe = window.App.loaded_graph_config.GraphgenTmpl.relative_time,
            substract_seconds, result;
        if (timeframe > 0) {
            substract_seconds = parseInt(timeframe, 10)
        } else {
            substract_seconds = 3600 * 3
        }
        result = {
            'start': now - substract_seconds,
            'end': now
        };
        return result
    },
});
App.Controllers.GraphgeneratorsListingController = Frontend.AppController.extend({
    components: ['Masschange'],
    _initialize: function() {
        this.Masschange.setup({
            'controller': 'graphgenerators',
            'checkboxattr': 'data-delete-display-text'
        })
    }
});
App.Controllers.GraphgeneratorsIndexController = Frontend.AppController.extend({
    host_uuid: null,
    host_name: '',
    service_uuid: null,
    service_name: '',
    currently_loaded_service_rules: {},
    user_default_timeout: 2000,
    debug: !1,
    _service_rules_timeout_id: 0,
    _service_rules_remove_timeout_id: 0,
    components: ['Ajaxloader', 'Rrd', 'BootstrapModal', 'Overlay', 'Time'],
    _initialize: function() {
        this.Time.setup();
        this.Ajaxloader.setup();
        this.BootstrapModal.setup({
            content: window.bootstrapModalContent,
            on_close: function() {
                $('#saveGraph').prop('disabled', !1)
            }
        });
        this.Overlay.setup({
            $ui: $('#widget-grid')
        });
        this.$services_select_box = $('#GraphgeneratorServiceUuid');
        this.bindChangeEventForHostSelectBox();
        this.bindChangeEventForServicesSelectBox();
        this.bindChangeEventForServiceRules();
        this.bindClickEventForRefreshGraphButton();
        this.bindClickEventForResetGraphButton();
        this.initValidation();
        this.bindClickEventForSave();
        this.deselectHostSelectBox();
        this.renderGraphConfiguration(window.App.loaded_graph_config)
    },
    renderGraphConfiguration: function(config) {
        if (Object.keys(config).length == 0) {
            if (this.debug) {
                console.info('No configuration found to load')
            }
            return
        }
        config = config.HostAndServices;
        for (var host_id in config) {
            for (var service_id in config[host_id].services) {
                var host_uuid = config[host_id].host_uuid,
                    host_name = config[host_id].host_name,
                    service_uuid = config[host_id].services[service_id].service_uuid,
                    service_name = config[host_id].services[service_id].service_name,
                    data_sources = config[host_id].services[service_id].data_sources,
                    host = {
                        id: host_id,
                        uuid: host_uuid,
                        name: host_name
                    },
                    service = {
                        id: service_id,
                        uuid: service_uuid,
                        name: service_name
                    },
                    onComplete = function() {
                        for (var i in data_sources) {
                            var ds = data_sources[i],
                                $obj = $('#AjaxServicerule_' + service_uuid + '_' + ds);
                            if ($obj.length == 0) {
                                return
                            }
                            $obj.prop('checked', !0).trigger('change')
                        }
                    };
                this._loadServiceRule(host, service, onComplete)
            }
        }
    },
    deselectHostSelectBox: function() {
        $('#GraphgeneratorHostUuid').find(':selected').prop('selected', !1).trigger('chosen:updated')
    },
    initValidation: function() {
        $.validator.addMethod('custom_datetime', function(value, element) {
            var matches = value.match(/^(\d{2})\.(\d{2})\.(\d{4}) (\d{2}):(\d{2}):(\d{2})$/);
            if (matches === null) {
                return !1
            } else {
                var year = parseInt(matches[3], 10);
                var month = parseInt(matches[2], 10) - 1;
                var day = parseInt(matches[1], 10);
                var hour = parseInt(matches[4], 10);
                var minute = parseInt(matches[5], 10);
                var second = parseInt(matches[6], 10);
                var date = new Date(year, month, day, hour, minute, second);
                return !(date.getFullYear() !== year || date.getMonth() != month || date.getDate() !== day || date.getHours() !== hour || date.getMinutes() !== minute || date.getSeconds() !== second)
            }
        }, 'Please enter a valid date and time.');
        $('#GraphgeneratorIndexForm').validate({
            rules: {
                'data[Graphgenerator][name]': {
                    required: !0,
                    minlength: 3
                },
                'data[Graphgenerator][time]': {
                    required: !0,
                    minlength: 3
                }
            },
            messages: {},
            errorPlacement: function($error, $element) {
                var $icon = $('<i>', {
                        class: 'fa fa-exclamation-triangle',
                        'data-toggle': 'tooltip',
                        'data-placement': 'right',
                        title: $error.text()
                    }).css({
                        'font-size': '22px',
                        color: '#a11b1b',
                        padding: '0 5px',
                        transition: 'all 2'
                    }),
                    $warning = $('<div>', {
                        class: 'icon-warning input-group-btn'
                    }).css({
                        'transition': 'all 2s'
                    }).append($icon);
                $icon.tooltip();
                var $parent = $element.parent('.input-group');
                var $icon_warning = $parent.find('.icon-warning');
                if ($icon_warning.length) {
                    $icon_warning.find('.fa').tooltip('destroy');
                    $icon_warning.remove()
                }
                $parent.append($warning);
                $icon.show();
                return !0
            },
            highlight: function(element) {
                $(element).parents('.input-group').removeClass('has-success').addClass('has-error')
            },
            unhighlight: function(element) {
                var $parent = $(element).parents('.input-group');
                $parent.removeClass('has-error').addClass('has-success');
                $parent.find('.icon-warning').html('')
            }
        })
    },
    _saveGraphTemplate: function(data, on_complete) {
        var self = this,
            url = '/graphgenerators/saveGraphTemplate.json';
        data = typeof data === 'object' ? data : {};
        self.xhrRequestData(url, on_complete, data)
    },
    bindClickEventForSave: function() {
        var self = this,
            onSaveClickCallback = function() {
                var $this = $(this),
                    $form = $this.parents('form');
                $form.find('input:not([name])').attr('name', 'noname');
                $this.prop('disabled', !0);
                if (!$form.valid()) {
                    console.warn('Form isn\'t valid. The data wasn\'t saved.');
                    $this.prop('disabled', !1);
                    return
                }
                var name = $form.find('#GraphgeneratorName').val(),
                    time = $form.find('#GraphgeneratorRelativeTime').val(),
                    save_service_rules = self.getCurrentServiceRulesForSave(),
                    submitData = {
                        GraphgenTmpl: {
                            name: name,
                            relative_time: time
                        },
                        GraphgenTmplConf: []
                    };
                if (App.loaded_graph_config != null && App.loaded_graph_config.GraphgenTmpl != null && App.loaded_graph_config.GraphgenTmpl.id > 0) {
                    submitData.GraphgenTmpl.id = App.loaded_graph_config.GraphgenTmpl.id
                }
                for (var host_uuid in save_service_rules) {
                    for (var service_id in save_service_rules[host_uuid]) {
                        submitData.GraphgenTmplConf.push({
                            service_id: service_id,
                            data_sources: JSON.stringify(save_service_rules[host_uuid][service_id])
                        })
                    }
                }
                if (Object.keys(save_service_rules).length == 0) {
                    self.BootstrapModal.show('was-not-saved-no-service-chosen', !0);
                    return
                }
                self._saveGraphTemplate(submitData, function(response) {
                    if (response.responseJSON && response.responseJSON.success) {
                        self.BootstrapModal.show('successfully-saved')
                    } else {
                        self.BootstrapModal.show('not-saved')
                    }
                })
            };
        $('#saveGraph').on('click', onSaveClickCallback)
    },
    getCurrentServiceRulesForSave: function() {
        var service_rules = {};
        $('.servicerule_control').each(function(index, checkbox) {
            var $checkbox = $(checkbox);
            if ($checkbox.length == 0 || $checkbox.prop('checked') == !1) {
                return
            }
            var ds_number = $checkbox.val(),
                service_id = $checkbox.data('service-id'),
                host_uuid = $checkbox.data('host-uuid');
            if (typeof service_rules[host_uuid] !== 'object') {
                service_rules[host_uuid] = {}
            }
            if (typeof service_rules[host_uuid][service_id] !== 'object') {
                service_rules[host_uuid][service_id] = []
            }
            service_rules[host_uuid][service_id].push(ds_number)
        });
        return service_rules
    },
    getCurrentServiceRules: function() {
        var service_rules = {};
        $('.servicerule_control').each(function(index, checkbox) {
            var $checkbox = $(checkbox);
            if ($checkbox.length == 0 || $checkbox.prop('checked') == !1) {
                return
            }
            var ds_number = $checkbox.val(),
                service_rule_name = $checkbox.data('service-rule-name'),
                service_id = $checkbox.data('service-id'),
                service_name = $checkbox.data('service-name'),
                service_uuid = $checkbox.data('service-uuid'),
                host_uuid = $checkbox.data('host-uuid'),
                host_name = $checkbox.data('host-name');
            if (typeof service_rules[host_uuid] !== 'object') {
                service_rules[host_uuid] = {}
            }
            if (typeof service_rules[host_uuid][service_uuid] !== 'object') {
                service_rules[host_uuid][service_uuid] = {}
            }
            if (typeof service_rules[host_uuid][service_uuid][ds_number] !== 'object') {
                service_rules[host_uuid][service_uuid][ds_number] = {}
            }
            service_rules[host_uuid][service_uuid][ds_number].service_id = service_id;
            service_rules[host_uuid][service_uuid][ds_number].service_name = service_name;
            service_rules[host_uuid][service_uuid][ds_number].service_rule_name = service_rule_name;
            service_rules[host_uuid][service_uuid][ds_number].host_name = host_name
        });
        return service_rules
    },
    xhrRequestData: function(url, on_complete, data, options) {
        data = (data == null ? {} : data);
        options = (options == null ? {} : options);
        var self = this,
            defaults = {
                url: url,
                type: 'post',
                cache: !1,
                data: data,
                dataType: 'json',
                error: function() {},
                success: function() {},
                complete: function(response) {
                    on_complete(response);
                    self.Ajaxloader.hide()
                }
            };
        $.extend(defaults, options);
        self.Ajaxloader.show();
        $.ajax(defaults)
    },
    bindChangeEventForHostSelectBox: function() {
        var self = this;
        $('#GraphgeneratorHostUuid').change(function() {
            var host_id = $(this).val(),
                host_name = $(this).find(':selected').text(),
                $services_select_box = self.$services_select_box,
                onComplete = function(response) {
                    $services_select_box.html('').trigger('chosen:updated').trigger('chosen:activate');
                    if (!response.responseJSON || response.responseJSON.sizeof <= 0) {
                        return
                    }
                    var response_json = response.responseJSON,
                        content = [],
                        index;
                    for (index in response_json.Services) {
                        content.push($('<option>', {
                            value: response_json.Services[index].uuid,
                            text: response_json.Services[index].name,
                            data: {
                                'service-id': response_json.Services[index].service_id
                            }
                        }))
                    }
                    $.fn.append.apply($services_select_box, content);
                    $services_select_box.val(null).trigger('chosen:updated').trigger('chosen:activate');
                    self._updateServicesSelectBox()
                };
            if (host_id == '0') {
                self.$services_select_box.html('').trigger('chosen:updated');
                $(this).trigger('chosen:activate');
                return
            }
            self.host_uuid = window.App.host_uuids[host_id];
            self.host_id = host_id;
            self.host_name = host_name;
            self._loadServicesByHostId(host_id, onComplete)
        })
    },
    _loadServicesByHostId: function(host_id, on_complete) {
        on_complete = typeof on_complete == 'function' ? on_complete : function() {};
        var url = '/Graphgenerators/loadServicesByHostId/' + parseInt(host_id, 10) + '.json',
            self = this;
        self.xhrRequestData(url, on_complete)
    },
    bindChangeEventForServicesSelectBox: function() {
        var self = this;
        self.$services_select_box.change(function() {
            if (!self.host_uuid) {
                return
            }
            var $serviceSelectBox = $(this);
            self.service_uuid = $serviceSelectBox.val();
            self.service_name = $serviceSelectBox.find(':selected').text();
            self.service_id = $serviceSelectBox.find(':selected').data('service-id');
            var host = {
                    id: self.host_id,
                    uuid: self.host_uuid,
                    name: self.host_name
                },
                service = {
                    id: self.service_id,
                    uuid: self.service_uuid,
                    name: self.service_name
                },
                on_complete = function() {
                    self._updateServicesSelectBox();
                    $serviceSelectBox.val(null).trigger('chosen:updated')
                };
            self._loadServiceRule(host, service, on_complete)
        })
    },
    _loadServiceRule: function(host, service, on_complete) {
        on_complete = typeof on_complete == 'function' ? on_complete : function() {};
        var self = this,
            url = '/Graphgenerators/loadServiceruleFromService/' + encodeURIComponent(host.uuid) + '/' + encodeURIComponent(service.uuid) + '.json',
            $target = $('#serviceRules'),
            on_complete_xhr = function(response) {
                if (!response.responseJSON || response.responseJSON.sizeof <= 0)
                    return;
                var response_json = response.responseJSON,
                    perfdata_structure = response_json.perfdataStructure,
                    $chosen_div;
                $chosen_div = self._addServiceRuleEntry(perfdata_structure, host, service);
                $target.append($chosen_div);
                $chosen_div.slideDown('fast');
                if (typeof self.currently_loaded_service_rules[host.id] != 'object') {
                    self.currently_loaded_service_rules[host.id] = {}
                }
                self.currently_loaded_service_rules[host.id][service.uuid] = !0;
                on_complete($chosen_div)
            };
        if (service.uuid != '0') {
            self.xhrRequestData(url, on_complete_xhr, {}, {
                async: !1
            })
        }
    },
    _addServiceRuleEntry: function(perfdata_structure, host, service) {
        var self = this,
            rows = [],
            key, $chosen_div = $('<div>', {
                class: 'chosen-service',
                style: 'display: none'
            }),
            $titleRowDiv = $('<div>', {
                class: 'row title-row'
            }),
            $title_host_name = $('<span>', {
                text: host.name,
                class: 'col-md-5 title',
                style: 'overflow: hidden'
            }),
            $title_service_name = $('<span>', {
                text: service.name,
                class: 'col-md-5 title',
                style: 'overflow: hidden'
            }),
            $removeIcon = $('<a>', {
                class: 'glyphicon glyphicon-remove',
                title: 'Remove this service',
                css: {
                    cursor: 'pointer',
                    'text-decoration': 'none'
                },
                click: function() {
                    var $this = $(this),
                        $chosen_service = $this.parents('.chosen-service'),
                        $service_rule = $chosen_service.find('input.servicerule_control'),
                        host_uuid = $service_rule.data('host-uuid'),
                        service_uuid = $service_rule.data('service-uuid');
                    self.currently_loaded_service_rules[host.id][service_uuid] = !1;
                    $chosen_service.slideUp('fast', function() {
                        $(this).remove();
                        if (self._service_rules_timeout_id != 0) {
                            clearTimeout(self._service_rules_timeout_id)
                        }
                        self._service_rules_timeout_id = setTimeout(function() {
                            var time_period = self.getConfiguredTimePeriod(),
                                service_rules = self.getCurrentServiceRules();
                            if (Object.keys(service_rules).length == 0) {
                                self.Rrd.resetGraph();
                                $('.graph_legend').hide()
                            } else {
                                self.Overlay.deactivateUi();
                                self.Rrd.drawServiceRules(service_rules, time_period, function() {
                                    self.Overlay.activateUi()
                                })
                            }
                            self._updateServicesSelectBox()
                        }, self.user_default_timeout)
                    })
                }
            });
        for (key in perfdata_structure) {
            var current_object = perfdata_structure[key],
                ds = current_object.ds,
                name = current_object.name,
                unit = current_object.unit,
                $row = $('<div>', {
                    'class': 'row'
                }),
                $ajax_service_rule_label = $('<label>', {
                    'class': 'col col-md-6 control-label text-left',
                    'text': name + ' (' + unit + ')'
                }),
                $switch_span = $('<span>', {
                    'class': 'onoffswitch'
                }),
                $checkbox_input = $('<input>', {
                    type: 'checkbox',
                    class: 'onoffswitch-checkbox servicerule_control',
                    id: 'AjaxServicerule_' + service.uuid + '_' + ds,
                    value: ds,
                    data: {
                        'service-rule-name': name,
                        'service-uuid': service.uuid,
                        'service-name': service.name,
                        'service-id': service.id,
                        'host-uuid': host.uuid,
                        'host-name': host.name
                    }
                }),
                $label = $('<label>', {
                    'for': 'AjaxServicerule_' + service.uuid + '_' + ds,
                    'class': 'onoffswitch-label'
                }),
                $span = $('<span>', {
                    'data-swchon-text': name,
                    'data-swchoff-text': name,
                    'class': 'onoffswitch-inner'
                }),
                $other_span = $('<span>', {
                    'class': 'onoffswitch-switch'
                });
            $label.append($span).append($other_span);
            $switch_span.append($checkbox_input).append($label);
            $row.append($ajax_service_rule_label).append($switch_span);
            rows.push($row)
        }
        $titleRowDiv.append($title_host_name);
        $titleRowDiv.append($title_service_name);
        $titleRowDiv.append('&nbsp;');
        $titleRowDiv.append($removeIcon);
        $chosen_div.append($titleRowDiv);
        $.fn.append.apply($chosen_div, rows);
        return $chosen_div
    },
    bindChangeEventForServiceRules: function() {
        var self = this;
        $(document).on('change', '.servicerule_control', function() {
            if (self._service_rules_timeout_id != 0) {
                clearTimeout(self._service_rules_timeout_id);
                self._service_rules_timeout_id = 0
            }
            self._service_rules_timeout_id = setTimeout(function() {
                self.Ajaxloader.show();
                self._updateGraphByServiceRules();
                clearTimeout(self._service_rules_timeout_id);
                self._service_rules_timeout_id = 0
            }, self.user_default_timeout)
        })
    },
    _updateGraphByServiceRules: function() {
        var self = this,
            service_rules = self.getCurrentServiceRules(),
            time_period = self.getConfiguredTimePeriod(),
            host_and_service_uuids = {},
            service_uuid, host_uuid;
        if (Object.keys(service_rules).length == 0) {
            self.Ajaxloader.hide();
            return
        }
        for (host_uuid in service_rules) {
            if (typeof host_and_service_uuids[host_uuid] !== 'object') {
                host_and_service_uuids[host_uuid] = []
            }
            for (service_uuid in service_rules[host_uuid]) {
                host_and_service_uuids[host_uuid].push(service_uuid)
            }
        }
        self.Overlay.deactivateUi();
        self.Rrd.setup({
            url: '/Graphgenerators/fetchGraphData/.json',
            host_and_service_uuids: host_and_service_uuids,
            selector: '#graph',
            height: '350px',
            timezoneOffset: this.Time.timezoneOffset,
            timeout_in_ms: self.user_default_timeout,
            error_callback: function(response, status) {
                self.Overlay.activateUi();
                self.BootstrapModal.show('request-took-to-long')
            },
            update_plot: function(event, plot, action) {
                var axes = plot.getAxes(),
                    min = axes.xaxis.min.toFixed(2),
                    max = axes.xaxis.max.toFixed(2),
                    start_timestamp = parseInt(min, 10),
                    end_timestamp = parseInt(max, 10),
                    start_date = new Date(parseInt(min, 10)),
                    end_date = new Date(parseInt(max, 10)),
                    formatted_start_date = sprintf('%d.%d.%d %02d:%02d:%02d', start_date.getDate(), start_date.getMonth() + 1, start_date.getFullYear(), start_date.getHours(), start_date.getMinutes(), start_date.getSeconds()),
                    formatted_end_date = sprintf('%d.%d.%d %02d:%02d:%02d', end_date.getDate(), end_date.getMonth() + 1, end_date.getFullYear(), end_date.getHours(), end_date.getMinutes(), end_date.getSeconds()),
                    time_range = {
                        start: start_timestamp,
                        end: end_timestamp
                    },
                    update_plot_this = this;
                if (self._service_rules_timeout_id > 0) {
                    clearTimeout(self._service_rules_timeout_id);
                    self._service_rules_timeout_id = 0
                }
                self._service_rules_timeout_id = setTimeout(function() {
                    self.Overlay.deactivateUi();
                    $('#GraphgeneratorStart').val(formatted_start_date);
                    $('#GraphgeneratorEnd').val(formatted_end_date);
                    update_plot_this.drawServiceRules(self.getCurrentServiceRules(), time_range, function() {
                        self.Overlay.activateUi()
                    })
                }, self.user_default_timeout)
            }
        });
        self.Rrd.drawServiceRules(service_rules, time_period, function() {
            $('.graph_legend').show();
            self.Ajaxloader.hide();
            self.Overlay.activateUi()
        });
        $('#resetGraph').show()
    },
    _updateServicesSelectBox: function() {
        var self = this,
            $service_select_box = $('#GraphgeneratorServiceUuid');
        if (!self.currently_loaded_service_rules[self.host_id]) {
            return
        }
        var activated_service_uuids = [];
        for (var loaded_service_uuid in self.currently_loaded_service_rules[self.host_id]) {
            if (!self.currently_loaded_service_rules[self.host_id][loaded_service_uuid]) {
                continue
            }
            activated_service_uuids.push(loaded_service_uuid)
        }
        var all_service_uuids = [];
        $service_select_box.find('option').each(function() {
            if ($(this).val() == '0') {
                return
            }
            all_service_uuids.push($(this).val())
        });
        for (var i = 0; i < all_service_uuids.length; i++) {
            var service_uuid = all_service_uuids[i],
                $option = $service_select_box.find('option[value="' + service_uuid + '"]');
            if ($.inArray(service_uuid, activated_service_uuids) != -1) {
                $option.attr('disabled', '')
            } else {
                $option.removeAttr('disabled')
            }
        }
        $service_select_box.trigger('chosen:updated')
    },
    getConfiguredTimePeriod: function() {
        var $field = $('#GraphgeneratorRelativeTime'),
            now = parseInt(this.Time.getCurrentTimeWithOffset(0).getTime() / 1000, 10),
            substract_seconds, result;
        if ($field.length > 0) {
            substract_seconds = parseInt($field.val(), 10)
        } else {
            substract_seconds = 3600 * 3
        }
        result = {
            'start': now - substract_seconds,
            'end': now
        };
        return result
    },
    bindClickEventForResetGraphButton: function() {
        var self = this;
        $('#resetGraph').click(function() {
            self.Rrd.resetGraph();
            $('#serviceRules').html('');
            var $start_time_text_field = $('#GraphgeneratorStart'),
                $stop_time_text_field = $('#GraphgeneratorEnd');
            $start_time_text_field.val($start_time_text_field.data('default-date'));
            $stop_time_text_field.val($stop_time_text_field.data('default-date'));
            $('#GraphgeneratorHostUuid').val(null).trigger('chosen:updated');
            self.$services_select_box.val(null).trigger('chosen:updated');
            self.currently_loaded_service_rules = [];
            $('.graph_legend').hide()
        })
    },
    bindClickEventForRefreshGraphButton: function() {
        var self = this;
        $('#refreshGraph').on('click', function() {
            self.Ajaxloader.show();
            if (self._service_rules_timeout_id != 0) {
                clearTimeout(self._service_rules_timeout_id);
                self._service_rules_timeout_id = 0
            }
            self._updateGraphByServiceRules()
        })
    }
});
App.Controllers.ServiceescalationsAddController = Frontend.AppController.extend({
    components: ['Ajaxloader', 'ContainerSelectbox'],
    _initialize: function() {
        var self = this;
        this.Ajaxloader.setup();
        this.ContainerSelectbox.setup(this.Ajaxloader);
        this.ContainerSelectbox.addContainerEventListener({
            selectBoxSelector: '#ServiceescalationContainerId',
            ajaxUrl: '/Serviceescalations/loadElementsByContainerId/:selectBoxValue:.json',
            optionGroupFieldTypes: {
                services: '#ServiceescalationService',
                servicesExcluded: '#ServiceescalationServiceExcluded'
            },
            fieldTypes: {
                servicegroups: '#ServiceescalationServicegroup',
                servicegroupsExcluded: '#ServiceescalationServicegroupExcluded',
                timeperiods: '#ServiceescalationTimeperiodId',
                contacts: '#ServiceescalationContact',
                contactgroups: '#ServiceescalationContactgroup'
            },
            dataPlaceholderEmpty: self.getVar('data_placeholder_empty'),
            dataPlaceholder: self.getVar('data_placeholder')
        });
        $(document).on('click', '.group-result', function() {
            var unselected = $(this).nextUntil('.group-result').not('.result-selected');
            if (unselected.length) {
                unselected.trigger('mouseup')
            } else {
                $(this).nextUntil('.group-result').each(function() {
                    $('a.search-choice-close[data-option-array-index="' + $(this).data('option-array-index') + '"]').trigger('click')
                })
            }
        });
        $('[id^=ServiceescalationService]').change(function() {
            var $this = $(this);
            self.refreshServices($this.val(), $this, $this.attr('target'))
        });
        if ($('#ServiceescalationService').val() !== null || $('#ServiceescalationServiceExcluded').val() !== null) {
            $('#ServiceescalationService').children('option').each(function(intKey, OptionObject) {
                if (in_array(OptionObject.value, $('#ServiceescalationServiceExcluded').val())) {
                    $OptionObject = $(OptionObject);
                    $OptionObject.prop('disabled', !0)
                }
            });
            $('#ServiceescalationServiceExcluded').children('option').each(function(intKey, OptionObject) {
                if (in_array(OptionObject.value, $('#ServiceescalationService').val())) {
                    $OptionObject = $(OptionObject);
                    $OptionObject.prop('disabled', !0)
                }
            });
            $('#ServiceescalationService').trigger("chosen:updated").change();
            $('#ServiceescalationServiceExcluded').trigger("chosen:updated").change()
        }
        if ($('#ServiceescalationServicegroup').val() !== null || $('#ServiceescalationServicegroupExcluded').val() !== null) {
            $('#ServiceescalationServicegroup').children('option').each(function(intKey, OptionObject) {
                if (in_array(OptionObject.value, $('#ServiceescalationServicegroupExclude').val())) {
                    $OptionObject = $(OptionObject);
                    $OptionObject.prop('disabled', !0)
                }
            });
            $('#ServiceescalationServicegroupExcluded').children('option').each(function(intKey, OptionObject) {
                if (in_array(OptionObject.value, $('#ServiceescalationServicegroup').val())) {
                    $OptionObject = $(OptionObject);
                    $OptionObject.prop('disabled', !0)
                }
            });
            $('#ServiceescalationServicegroup').trigger("chosen:updated").change();
            $('#ServiceescalationServicegroupExcluded').trigger("chosen:updated").change()
        }
    },
    refreshServices: function(selected_services, selectboxObject, target) {
        for (var key in selected_services) {
            $(target).find('option').each(function(intKey, OptionObject) {
                $OptionObject = $(OptionObject);
                if ($OptionObject.val() == selected_services[key]) {
                    if (!$OptionObject.prop('disabled')) {
                        $OptionObject.prop('disabled', !0)
                    }
                }
            })
        }
        var targetValue = $(target).val();
        $(target).find('option').each(function(intKey, OptionObject) {
            $OptionObject = $(OptionObject);
            if (targetValue == null) {
                targetValue = []
            }
            if (selected_services == null) {
                selected_services = []
            }
            if (!in_array($OptionObject.val(), selected_services) && !in_array($OptionObject.val(), targetValue)) {
                if ($OptionObject.prop('disabled')) {
                    $OptionObject.prop('disabled', null)
                }
            }
        });
        $(target).trigger("chosen:updated")
    }
});
App.Controllers.ServiceescalationsEditController = Frontend.AppController.extend({
    components: ['Ajaxloader', 'ContainerSelectbox'],
    _initialize: function() {
        var self = this;
        this.Ajaxloader.setup();
        this.ContainerSelectbox.setup(this.Ajaxloader);
        this.ContainerSelectbox.addContainerEventListener({
            selectBoxSelector: '#ServiceescalationContainerId',
            ajaxUrl: '/Serviceescalations/loadElementsByContainerId/:selectBoxValue:.json',
            optionGroupFieldTypes: {
                services: '#ServiceescalationService',
                servicesExcluded: '#ServiceescalationServiceExcluded'
            },
            fieldTypes: {
                servicegroups: '#ServiceescalationServicegroup',
                servicegroupsExcluded: '#ServiceescalationServicegroupExcluded',
                timeperiods: '#ServiceescalationTimeperiodId',
                contacts: '#ServiceescalationContact',
                contactgroups: '#ServiceescalationContactgroup'
            },
            dataPlaceholderEmpty: self.getVar('data_placeholder_empty'),
            dataPlaceholder: self.getVar('data_placeholder')
        });
        $(document).on('click', '.group-result', function() {
            var unselected = $(this).nextUntil('.group-result').not('.result-selected');
            if (unselected.length) {
                unselected.trigger('mouseup')
            } else {
                $(this).nextUntil('.group-result').each(function() {
                    $('a.search-choice-close[data-option-array-index="' + $(this).data('option-array-index') + '"]').trigger('click')
                })
            }
        });
        $('[id^=ServiceescalationService]').change(function() {
            var $this = $(this);
            self.refreshServices($this.val(), $this, $this.attr('target'))
        });
        if ($('#ServiceescalationService').val() !== null || $('#ServiceescalationServiceExcluded').val() !== null) {
            $('#ServiceescalationService').children('option').each(function(intKey, OptionObject) {
                if (in_array(OptionObject.value, $('#ServiceescalationServiceExcluded').val())) {
                    $OptionObject = $(OptionObject);
                    $OptionObject.prop('disabled', !0)
                }
            });
            $('#ServiceescalationServiceExcluded').children('option').each(function(intKey, OptionObject) {
                if (in_array(OptionObject.value, $('#ServiceescalationService').val())) {
                    $OptionObject = $(OptionObject);
                    $OptionObject.prop('disabled', !0)
                }
            });
            $('#ServiceescalationService').trigger("chosen:updated").change();
            $('#ServiceescalationServiceExcluded').trigger("chosen:updated").change()
        }
        if ($('#ServiceescalationServicegroup').val() !== null || $('#ServiceescalationServicegroupExcluded').val() !== null) {
            $('#ServiceescalationServicegroup').children('option').each(function(intKey, OptionObject) {
                if (in_array(OptionObject.value, $('#ServiceescalationServicegroupExclude').val())) {
                    $OptionObject = $(OptionObject);
                    $OptionObject.prop('disabled', !0)
                }
            });
            $('#ServiceescalationServicegroupExcluded').children('option').each(function(intKey, OptionObject) {
                if (in_array(OptionObject.value, $('#ServiceescalationServicegroup').val())) {
                    $OptionObject = $(OptionObject);
                    $OptionObject.prop('disabled', !0)
                }
            });
            $('#ServiceescalationServicegroup').trigger("chosen:updated").change();
            $('#ServiceescalationServicegroupExcluded').trigger("chosen:updated").change()
        }
    },
    refreshServices: function(selected_services, selectboxObject, target) {
        for (var key in selected_services) {
            $(target).find('option').each(function(intKey, OptionObject) {
                $OptionObject = $(OptionObject);
                if ($OptionObject.val() == selected_services[key]) {
                    if (!$OptionObject.prop('disabled')) {
                        $OptionObject.prop('disabled', !0)
                    }
                }
            })
        }
        var targetValue = $(target).val();
        $(target).find('option').each(function(intKey, OptionObject) {
            $OptionObject = $(OptionObject);
            if (targetValue == null) {
                targetValue = []
            }
            if (selected_services == null) {
                selected_services = []
            }
            if (!in_array($OptionObject.val(), selected_services) && !in_array($OptionObject.val(), targetValue)) {
                if ($OptionObject.prop('disabled')) {
                    $OptionObject.prop('disabled', null)
                }
            }
        });
        $(target).trigger("chosen:updated")
    }
});
App.Controllers.GraphCollectionsIndexController = Frontend.AppController.extend({
    components: ['Masschange'],
    _initialize: function() {
        this.Masschange.setup({
            'controller': 'graph_collections',
            'checkboxattr': 'data-delete-display-text'
        })
    }
});
App.Controllers.GraphCollectionsDisplayController = Frontend.AppController.extend({
    components: ['Rrd', 'Ajaxloader', 'Time'],
    _initialize: function() {
        this.Time.setup();
        var self = this;
        self.bindSelectBoxEvent('#GraphCollectionId', '#render-graph');
        if (self.getVar('graphCollectionId') != null) {
            $('#GraphCollectionId').trigger('change')
        }
        self.Ajaxloader.setup();
        self.GRAPH_HEIGHT = 350
    },
    bindSelectBoxEvent: function(select_box_selector, target_selector) {
        var self = this;
        var $select_box = $(select_box_selector);
        var $target = $(target_selector);
        if ($select_box.length < 1 || $target.length < 1) {
            throw new Error('Either the selector for the select box or the selector for the target container is invalid.')
        }
        $select_box.on('change', function() {
            var collection_id = parseInt($(this).val(), 10);
            if (isNaN(collection_id) || collection_id < 1) {
                $target.html('');
                return
            }
            self.loadCollectionGraphData(collection_id, function(data) {
                self.Ajaxloader.show();
                if (data == null || data.responseJSON == null || data.responseJSON.collection == null || data.responseJSON.collection.length === 0) {
                    return
                }
                var template_amount = data.responseJSON.collection.GraphgenTmpl.length,
                    templates = data.responseJSON.collection.GraphgenTmpl,
                    target_classes, result, i;
                if (template_amount === 0) {
                    return
                }
                $target.html('');
                $.each(templates, function(i, elem) {
                    var host_and_service_uuids = elem.HostAndServiceUuids,
                        service_rules = elem.ServiceRules,
                        time_period = self.createTimePeriod(elem.relative_time),
                        total_sec = parseInt(elem.relative_time, 10),
                        formatted_time = moment.duration(total_sec * 1000).humanize(),
                        result = [],
                        target_class = 'graph-' + (i + 1),
                        $div_graph = $('<div>', {
                            class: 'graph ' + target_class
                        }),
                        $div_legend = $('<div>', {
                            class: 'graph_legend graph_legend_' + (i + 1)
                        }),
                        $div_title = $('<div>', {
                            class: 'title'
                        }).append($('<h4>', {
                            text: elem.name + ' - ' + formatted_time,
                            style: 'margin-bottom: 10px'
                        }));
                    result.push($div_title);
                    result.push($div_legend);
                    result.push($div_graph);
                    $.fn.append.apply($target, result);
                    self.Rrd.setup({
                        url: '/Graphgenerators/fetchGraphData.json',
                        host_and_service_uuids: service_rules,
                        selector: '.' + target_class,
                        height: self.GRAPH_HEIGHT + 'px',
                        timeout_in_ms: self.user_default_timeout,
                        async: !1,
                        timezoneOffset: self.Time.timezoneOffset,
                        error_callback: function(response, status) {
                            throw new Error('An error occured with self.Rrd.setup()')
                        },
                        flot_options: {
                            zoom: {
                                interactive: !1
                            },
                            pan: {
                                interactive: !1
                            },
                            legend: {
                                container: $('.graph_legend_' + (i + 1))
                            }
                        }
                    });
                    self.Rrd.drawServiceRules(host_and_service_uuids, time_period, function() {
                        $('.graph_legend').show()
                    })
                });
                self.Ajaxloader.hide()
            })
        })
    },
    createTimePeriod: function(relative_time) {
        var now = parseInt(this.Time.getCurrentTimeWithOffset(0).getTime() / 1000, 10),
            substract_seconds;
        if (relative_time > 0) {
            substract_seconds = parseInt(relative_time, 10)
        } else {
            substract_seconds = 3600 * 3
        }
        return {
            'start': now - substract_seconds,
            'end': now
        }
    },
    loadCollectionGraphData: function(collection_id, on_complete) {
        $.ajax({
            url: '/graph_collections/loadCollectionGraphData/' + collection_id + '.json',
            type: 'post',
            cache: !1,
            dataType: 'json',
            error: function() {},
            success: function() {},
            complete: on_complete
        })
    }
});
App.Controllers.CommandsAddController = Frontend.AppController.extend({
    argumentNames: null,
    components: ['WebsocketSudo', 'Ajaxloader'],
    _initialize: function() {
        this.Ajaxloader.setup();
        $('#add_new_arg').click(function() {
            this.addArgument()
        }.bind(this));
        $('#loadMacrosOberview').click(function() {
            $('#macros_loader').show();
            $.ajax({
                url: "/Commands/loadMacros/",
                type: "POST",
                cache: !1,
                data: this.argumentNames,
                error: function() {},
                success: function() {},
                complete: function(response) {
                    $('#MacroContent').html(response.responseText);
                    $('#macros_loader').hide()
                }.bind(this)
            })
        });
        $(document).on("click", ".deleteCommandArg", function(e) {
            $this = $(this);
            $this.parent().parent().remove()
        });
        this.$jqconsole = null;
        this.WebsocketSudo.setup(this.getVar('websocket_url'), this.getVar('akey'));
        this.WebsocketSudo._errorCallback = function() {
            $('#error_msg').html('<div class="alert alert-danger alert-block"><a href="#" data-dismiss="alert" class="close">×</a><h5 class="alert-heading"><i class="fa fa-warning"></i> Error</h5>Could not connect to SudoWebsocket Server</div>');
            $('#console').block({
                fadeIn: 1000,
                message: '<i class="fa fa-minus-circle fa-5x"></i>',
                theme: !1
            });
            $('.blockElement').css({
                'background-color': '',
                'border': 'none',
                'color': '#FFFFFF'
            })
        }
        this.WebsocketSudo.connect();
        this.loadConsole();
        this.WebsocketSudo._callback = function(transmitted) {
            this.$jqconsole.Write(transmitted.payload, 'jqconsole-output')
        }.bind(this)
    },
    loadConsole: function() {
        this.$jqconsole = $('#console').jqconsole('', 'nagios$ ');
        this.$jqconsole.Write(this.getVar('console_welcome'));
        var startPrompt = function() {
            var self = this;
            self.$jqconsole.Prompt(!0, function(input) {
                self.WebsocketSudo.send(self.WebsocketSudo.toJson('execute_nagios_command', input));
                startPrompt()
            })
        }.bind(this);
        startPrompt()
    },
    addArgument: function() {
        this.Ajaxloader.show();
        this.updateArgumentNames();
        this.$button = $('.addMacro');
        this.$button.prop('disabled', !0);
        $.ajax({
            url: "/Commands/addCommandArg/",
            type: "POST",
            cache: !1,
            data: this.argumentNames,
            error: function() {},
            success: function() {},
            complete: function(response) {
                $('#command_args').append(response.responseText);
                this.Ajaxloader.hide();
                this.$button.prop('disabled', !1)
            }.bind(this)
        })
    },
    updateArgumentNames: function() {
        this.argumentNames = {};
        $("[argument='name']").each(function(intKey, nameObject) {
            this.argumentNames[$(nameObject).attr('uuid')] = $(nameObject).val()
        }.bind(this))
    }
});
App.Controllers.CommandsHostchecksController = Frontend.AppController.extend({
    components: ['Masschange'],
    _initialize: function() {
        this.Masschange.setup({
            'controller': 'commands',
            'checkboxattr': 'commandname',
            'useDeleteMessage': 'false'
        })
    }
});
App.Controllers.CommandsNotificationsController = Frontend.AppController.extend({
    components: ['Masschange'],
    _initialize: function() {
        this.Masschange.setup({
            'controller': 'commands',
            'checkboxattr': 'commandname',
            'useDeleteMessage': 'false'
        })
    }
});
App.Controllers.CommandsUsedByController = Frontend.AppController.extend({
    components: ['Masschange'],
    _initialize: function() {
        this.Masschange.setup({
            'controller': 'servicetemplates',
            'checkboxattr': 'servicename'
        })
    }
});
App.Controllers.CommandsEditController = Frontend.AppController.extend({
    argumentNames: null,
    components: ['WebsocketSudo', 'Ajaxloader'],
    _initialize: function() {
        this.Ajaxloader.setup();
        $('#add_new_arg').click(function() {
            this.addArgument()
        }.bind(this));
        $('#loadMacrosOberview').click(function() {
            $('#macros_loader').show();
            $.ajax({
                url: "/Commands/loadMacros/",
                type: "POST",
                cache: !1,
                data: this.argumentNames,
                error: function() {},
                success: function() {},
                complete: function(response) {
                    $('#MacroContent').html(response.responseText);
                    $('#macros_loader').hide()
                }.bind(this)
            })
        });
        $(document).on("click", ".deleteCommandArg", function(e) {
            $this = $(this);
            $this.parent().parent().remove()
        });
        this.$jqconsole = null;
        this.WebsocketSudo.setup(this.getVar('websocket_url'), this.getVar('akey'));
        this.WebsocketSudo._errorCallback = function() {
            $('#error_msg').html('<div class="alert alert-danger alert-block"><a href="#" data-dismiss="alert" class="close">×</a><h5 class="alert-heading"><i class="fa fa-warning"></i> Error</h5>Could not connect to SudoWebsocket Server</div>');
            $('#console').block({
                fadeIn: 1000,
                message: '<i class="fa fa-minus-circle fa-5x"></i>',
                theme: !1
            });
            $('.blockElement').css({
                'background-color': '',
                'border': 'none',
                'color': '#FFFFFF'
            })
        }
        this.WebsocketSudo.connect();
        this.loadConsole();
        this.WebsocketSudo._callback = function(transmitted) {
            this.$jqconsole.Write(transmitted.payload, 'jqconsole-output')
        }.bind(this)
    },
    loadConsole: function() {
        this.$jqconsole = $('#console').jqconsole('', 'nagios$ ');
        this.$jqconsole.Write(this.getVar('console_welcome'));
        var startPrompt = function() {
            var self = this;
            self.$jqconsole.Prompt(!0, function(input) {
                self.WebsocketSudo.send(self.WebsocketSudo.toJson('execute_nagios_command', input));
                startPrompt()
            })
        }.bind(this);
        startPrompt()
    },
    addArgument: function() {
        this.Ajaxloader.show();
        this.updateArgumentNames();
        this.$button = $('.addMacro');
        this.$button.prop('disabled', !0);
        $.ajax({
            url: "/Commands/addCommandArg/" + encodeURIComponent(this.getVar('command_id')),
            type: "POST",
            cache: !1,
            data: this.argumentNames,
            error: function() {},
            success: function() {},
            complete: function(response) {
                $('#command_args').append(response.responseText);
                this.Ajaxloader.hide();
                this.$button.prop('disabled', !1)
            }.bind(this)
        })
    },
    updateArgumentNames: function() {
        this.argumentNames = {};
        $("[argument='name']").each(function(intKey, nameObject) {
            this.argumentNames[$(nameObject).attr('uuid')] = $(nameObject).val()
        }.bind(this))
    }
});
App.Controllers.CommandsIndexController = Frontend.AppController.extend({
    components: ['Masschange'],
    _initialize: function() {
        this.Masschange.setup({
            'controller': 'commands',
            'checkboxattr': 'commandname',
            'useDeleteMessage': 'false'
        })
    }
});
App.Controllers.CommandsHandlerController = Frontend.AppController.extend({
    components: ['Masschange'],
    _initialize: function() {
        this.Masschange.setup({
            'controller': 'commands',
            'checkboxattr': 'commandname',
            'useDeleteMessage': 'false'
        })
    }
});
App.Controllers.ContactsAddController = Frontend.AppController.extend({
    components: ['Ajaxloader', 'CustomVariables'],
    _initialize: function() {
        var self = this;
        self.Ajaxloader.setup();
        self.CustomVariables.setup({
            controller: 'Contacts',
            ajaxUrl: 'Contacts/addCustomMacro',
            macrotype: 'CONTACT'
        });
        var timeperiodSelectors = ['#ContactHostTimeperiodId', '#ContactServiceTimeperiodId'];
        $('#ContactHostPushNotificationsEnabled').change(function() {
            var selectedValues = $('#ContactHostCommands').val();
            if (selectedValues === null) {
                selectedValues = []
            }
            var newValues = [];
            var pushHostNotificationCommandId = self.getVar('hostPushComamndId');
            if ($(this).prop('checked')) {
                selectedValues.push(pushHostNotificationCommandId);
                $('#ContactHostCommands').val(selectedValues)
            } else {
                selectedValues.forEach(function(id) {
                    if (id !== pushHostNotificationCommandId) {
                        newValues.push(id)
                    }
                });
                $('#ContactHostCommands').val(newValues)
            }
            $('#ContactHostCommands').trigger("chosen:updated")
        });
        $('#ContactServicePushNotificationsEnabled').change(function() {
            var selectedValues = $('#ContactServiceCommands').val();
            if (selectedValues === null) {
                selectedValues = []
            }
            var newValues = [];
            var pushServiceNotificationCommandId = self.getVar('servicePushComamndId');
            if ($(this).prop('checked')) {
                selectedValues.push(pushServiceNotificationCommandId);
                $('#ContactServiceCommands').val(selectedValues)
            } else {
                selectedValues.forEach(function(id) {
                    if (id !== pushServiceNotificationCommandId) {
                        newValues.push(id)
                    }
                });
                $('#ContactServiceCommands').val(newValues)
            }
            $('#ContactServiceCommands').trigger("chosen:updated")
        });
        $('#ContainerContainer').change(function() {
            var containerIds = $(this).val();
            if (containerIds === null) {
                for (var selectId in timeperiodSelectors) {
                    var $timeperiodSelectbox = $(timeperiodSelectors[selectId]);
                    $timeperiodSelectbox.html('');
                    $timeperiodSelectbox.attr('data-placeholder', self.getVar('data_placeholder_empty'));
                    $timeperiodSelectbox.trigger("chosen:updated")
                }
                return
            }
            if (containerIds.length > 0) {
                self.Ajaxloader.show();
                $.ajax({
                    url: '/Contacts/loadTimeperiods/.json',
                    type: 'post',
                    cache: !1,
                    data: {
                        container_ids: containerIds
                    },
                    dataType: 'json',
                    error: function() {},
                    success: function() {},
                    complete: function(response) {
                        for (var selectId in timeperiodSelectors) {
                            var $timeperiodSelectbox = $(timeperiodSelectors[selectId]);
                            $timeperiodSelectbox.html('');
                            $timeperiodSelectbox.attr('data-placeholder', self.getVar('data_placeholder_empty'));
                            var $timePeriods = response.responseJSON.timeperiods;
                            if (Object.keys($timePeriods).length > 0) {
                                $timeperiodSelectbox.attr('data-placeholder', self.getVar('data_placeholder'));
                                for (var key in $timePeriods) {
                                    $timeperiodSelectbox.append($('<option>', {
                                        value: $timePeriods[key].key,
                                        text: $timePeriods[key].value
                                    }))
                                }
                            }
                            $timeperiodSelectbox.trigger("chosen:updated")
                        }
                    }
                });
                $.ajax({
                    url: '/Contacts/loadUsersByContainerId/.json',
                    type: 'post',
                    cache: !1,
                    data: {
                        container_ids: containerIds
                    },
                    dataType: 'json',
                    error: function() {},
                    success: function() {},
                    complete: function(response) {
                        var $userSelectbox = $('#ContactUserId');
                        $userSelectbox.html('');
                        $userSelectbox.attr('data-placeholder', self.getVar('data_placeholder_empty'));
                        var $users = response.responseJSON.users;
                        if (Object.keys($users).length > 0) {
                            $userSelectbox.attr('data-placeholder', self.getVar('data_placeholder'));
                            $userSelectbox.append($('<option>', {}));
                            for (var key in $users) {
                                $userSelectbox.append($('<option>', {
                                    value: $users[key].key,
                                    text: $users[key].value
                                }))
                            }
                        }
                        $userSelectbox.trigger("chosen:updated")
                    }
                });
                self.Ajaxloader.hide()
            }
        })
    }
});
App.Controllers.ContactsAddContactgroupController = Frontend.AppController.extend({
    $table: null,
    $contacts: null,
    components: ['Ajaxloader'],
    _initialize: function() {
        this.Ajaxloader.setup();
        this.$contacts = $('#ContactId');
        var self = this;
        $('#ContainerParentId').change(function() {
            $this = $(this);
            self.loadContacts($this.val())
        })
    },
    loadContacts: function(container_id) {
        this.Ajaxloader.show();
        $.ajax({
            url: "/contactgroups/loadContacts/" + encodeURIComponent(container_id) + '.json',
            type: "POST",
            cache: !1,
            dataType: "json",
            error: function() {},
            success: function() {},
            complete: function(response) {
                this.$contacts.html('');
                if (response.responseJSON.sizeof > 0) {
                    this.$contacts.attr('data-placeholder', this.getVar('data_placeholder'));
                    for (var key in response.responseJSON.contacts) {
                        this.$contacts.append('<option value="' + key + '">' + response.responseJSON.contacts[key] + '</option>')
                    }
                } else {
                    this.$contacts.attr('data-placeholder', this.getVar('data_placeholder_empty'))
                }
                this.$contacts.trigger("chosen:updated");
                this.Ajaxloader.hide()
            }.bind(this)
        })
    }
});
App.Controllers.ContactsEditController = Frontend.AppController.extend({
    components: ['Ajaxloader', 'CustomVariables'],
    _initialize: function() {
        var self = this;
        this.Ajaxloader.setup();
        self.CustomVariables.setup({
            controller: 'Contacts',
            ajaxUrl: 'Contacts/addCustomMacro',
            macrotype: 'CONTACT'
        });
        var timeperiodSelectors = ['#ContactHostTimeperiodId', '#ContactServiceTimeperiodId'];
        $('#ContactHostPushNotificationsEnabled').change(function() {
            var selectedValues = $('#ContactHostCommands').val();
            if (selectedValues === null) {
                selectedValues = []
            }
            var newValues = [];
            var pushHostNotificationCommandId = self.getVar('hostPushComamndId');
            if ($(this).prop('checked')) {
                selectedValues.push(pushHostNotificationCommandId);
                $('#ContactHostCommands').val(selectedValues)
            } else {
                selectedValues.forEach(function(id) {
                    if (id !== pushHostNotificationCommandId) {
                        newValues.push(id)
                    }
                });
                $('#ContactHostCommands').val(newValues)
            }
            $('#ContactHostCommands').trigger("chosen:updated")
        });
        $('#ContactServicePushNotificationsEnabled').change(function() {
            var selectedValues = $('#ContactServiceCommands').val();
            if (selectedValues === null) {
                selectedValues = []
            }
            var newValues = [];
            var pushServiceNotificationCommandId = self.getVar('servicePushComamndId');
            if ($(this).prop('checked')) {
                selectedValues.push(pushServiceNotificationCommandId);
                $('#ContactServiceCommands').val(selectedValues)
            } else {
                selectedValues.forEach(function(id) {
                    if (id !== pushServiceNotificationCommandId) {
                        newValues.push(id)
                    }
                });
                $('#ContactServiceCommands').val(newValues)
            }
            $('#ContactServiceCommands').trigger("chosen:updated")
        });
        $('#ContainerContainer').change(function() {
            var containerIds = $(this).val();
            if (containerIds === null) {
                $.each(timeperiodSelectors, function(index, elem) {
                    $(elem).val('');
                    $(elem).trigger("chosen:updated")
                });
                return
            }
            if (containerIds.length > 0) {
                self.Ajaxloader.show();
                $.ajax({
                    url: '/Contacts/loadTimeperiods/.json',
                    type: 'post',
                    cache: !1,
                    data: {
                        container_ids: containerIds
                    },
                    dataType: 'json',
                    error: function() {},
                    success: function() {},
                    complete: function(response) {
                        for (var selectId in timeperiodSelectors) {
                            var $timeperiodSelectbox = $(timeperiodSelectors[selectId]);
                            $timeperiodSelectbox.html('');
                            $timeperiodSelectbox.attr('data-placeholder', self.getVar('data_placeholder_empty'));
                            var $timePeriods = response.responseJSON.timeperiods;
                            if (Object.keys($timePeriods).length > 0) {
                                $timeperiodSelectbox.attr('data-placeholder', self.getVar('data_placeholder'));
                                for (var key in $timePeriods) {
                                    $timeperiodSelectbox.append($('<option>', {
                                        value: $timePeriods[key].key,
                                        text: $timePeriods[key].value
                                    }))
                                }
                            }
                            $timeperiodSelectbox.trigger("chosen:updated")
                        }
                    }
                });
                $.ajax({
                    url: '/Contacts/loadUsersByContainerId/.json',
                    type: 'post',
                    cache: !1,
                    data: {
                        container_ids: containerIds
                    },
                    dataType: 'json',
                    error: function() {},
                    success: function() {},
                    complete: function(response) {
                        var $userSelectbox = $('#ContactUserId');
                        $userSelectbox.html('');
                        $userSelectbox.attr('data-placeholder', self.getVar('data_placeholder_empty'));
                        var $users = response.responseJSON.users;
                        if (Object.keys($users).length > 0) {
                            $userSelectbox.attr('data-placeholder', self.getVar('data_placeholder'));
                            $userSelectbox.append($('<option>', {}));
                            for (var key in $users) {
                                $userSelectbox.append($('<option>', {
                                    value: $users[key].key,
                                    text: $users[key].value
                                }))
                            }
                        }
                        $userSelectbox.trigger("chosen:updated")
                    }
                });
                self.Ajaxloader.hide()
            }
        })
    }
});
App.Controllers.ContactsIndexController = Frontend.AppController.extend({
    $table: null,
    components: ['Masschange'],
    _initialize: function() {
        var self = this;
        this.Masschange.setup({
            'controller': 'contacts',
            'checkboxattr': 'contactname',
            'useDeleteMessage': 'false'
        });
        $(".oitc-list-filter").click(function() {
            $('.chosen-container').css('width', '100%')
        });
        $('.onoffswitch-checkbox').each(function(i) {
            if (i % 2 === 0) {
                $(this).trigger('click')
            }
        })
    }
});
App.Controllers.HostdependenciesAddController = Frontend.AppController.extend({
    components: ['Ajaxloader', 'ContainerSelectbox'],
    _initialize: function() {
        var self = this;
        this.Ajaxloader.setup();
        this.ContainerSelectbox.setup(this.Ajaxloader);
        this.ContainerSelectbox.addContainerEventListener({
            selectBoxSelector: '#HostdependencyContainerId',
            ajaxUrl: '/Hostdependencies/loadElementsByContainerId/:selectBoxValue:.json',
            fieldTypes: {
                hosts: '#HostdependencyHost',
                hostsDependent: '#HostdependencyHostDependent',
                hostgroups: '#HostdependencyHostgroup',
                hostgroupsDependent: '#HostdependencyHostgroupDependent',
                timeperiods: '#HostdependencyTimeperiodId'
            },
            dataPlaceholderEmpty: self.getVar('data_placeholder_empty'),
            dataPlaceholder: self.getVar('data_placeholder'),
            event: 'change.hostContainer'
        });
        $('[id^=HostdependencyHost]').change(function() {
            $this = $(this);
            self.refreshHosts($this.val(), $this, $this.attr('target'))
        });
        if ($('#HostdependencyHost').val() !== null || $('#HostdependencyHostDependent').val() !== null) {
            $('#HostdependencyHost').children().each(function(intKey, OptionObject) {
                if (in_array(OptionObject.value, $('#HostdependencyHostDependent').val())) {
                    $OptionObject = $(OptionObject);
                    $OptionObject.prop('disabled', !0)
                }
            });
            $('#HostdependencyHostDependent').children().each(function(intKey, OptionObject) {
                if (in_array(OptionObject.value, $('#HostdependencyHost').val())) {
                    $OptionObject = $(OptionObject);
                    $OptionObject.prop('disabled', !0)
                }
            });
            $('#HostdependencyHost').trigger("chosen:updated");
            $('#HostdependencyHostDependent').trigger("chosen:updated")
        }
        if ($('#HostdependencyHostgroup').val() !== null || $('#HostdependencyHostgroupDependent').val() !== null) {
            $('#HostdependencyHostgroup').children().each(function(intKey, OptionObject) {
                if (in_array(OptionObject.value, $('#HostdependencyHostgroupDependent').val())) {
                    $OptionObject = $(OptionObject);
                    $OptionObject.prop('disabled', !0)
                }
            });
            $('#HostdependencyHostgroupDependent').children().each(function(intKey, OptionObject) {
                if (in_array(OptionObject.value, $('#HostdependencyHostgroup').val())) {
                    $OptionObject = $(OptionObject);
                    $OptionObject.prop('disabled', !0)
                }
            });
            $('#HostdependencyHostgroup').trigger("chosen:updated");
            $('#HostdependencyHostgroupDependent').trigger("chosen:updated")
        }
    },
    refreshHosts: function(selected_hosts, selectboxObject, target) {
        for (var key in selected_hosts) {
            $(target).children().each(function(intKey, OptionObject) {
                $OptionObject = $(OptionObject);
                if ($OptionObject.val() == selected_hosts[key]) {
                    if (!$OptionObject.prop('disabled')) {
                        $OptionObject.prop('disabled', !0)
                    }
                }
            })
        }
        var targetValue = $(target).val();
        $(target).children().each(function(intKey, OptionObject) {
            $OptionObject = $(OptionObject);
            if (targetValue == null) {
                targetValue = []
            }
            if (selected_hosts == null) {
                selected_hosts = []
            }
            if (!in_array($OptionObject.val(), selected_hosts) && !in_array($OptionObject.val(), targetValue)) {
                if ($OptionObject.prop('disabled')) {
                    $OptionObject.prop('disabled', null)
                }
            }
        });
        $(target).trigger("chosen:updated")
    }
});
App.Controllers.HostdependenciesEditController = Frontend.AppController.extend({
    components: ['Ajaxloader', 'ContainerSelectbox'],
    _initialize: function() {
        var self = this;
        this.Ajaxloader.setup();
        this.ContainerSelectbox.setup(this.Ajaxloader);
        this.ContainerSelectbox.addContainerEventListener({
            selectBoxSelector: '#HostdependencyContainerId',
            event: 'change.hostContainer',
            ajaxUrl: '/Hostdependencies/loadElementsByContainerId/:selectBoxValue:.json',
            fieldTypes: {
                hosts: '#HostdependencyHost',
                hostsDependent: '#HostdependencyHostDependent',
                hostgroups: '#HostdependencyHostgroup',
                hostgroupsDependent: '#HostdependencyHostgroupDependent',
                timeperiods: '#HostdependencyTimeperiodId'
            },
            dataPlaceholderEmpty: self.getVar('data_placeholder_empty'),
            dataPlaceholder: self.getVar('data_placeholder')
        });
        $('[id^=HostdependencyHost]').change(function() {
            $this = $(this);
            self.refreshHosts($this.val(), $this, $this.attr('target'))
        });
        if ($('#HostdependencyHost').val() !== null || $('#HostdependencyHostDependent').val() !== null) {
            $('#HostdependencyHost').children().each(function(intKey, OptionObject) {
                if (in_array(OptionObject.value, $('#HostdependencyHostDependent').val())) {
                    $OptionObject = $(OptionObject);
                    $OptionObject.prop('disabled', !0)
                }
            });
            $('#HostdependencyHostDependent').children().each(function(intKey, OptionObject) {
                if (in_array(OptionObject.value, $('#HostdependencyHost').val())) {
                    $OptionObject = $(OptionObject);
                    $OptionObject.prop('disabled', !0)
                }
            });
            $('#HostdependencyHost').trigger("chosen:updated");
            $('#HostdependencyHostDependent').trigger("chosen:updated")
        }
        if ($('#HostdependencyHostgroup').val() !== null || $('#HostdependencyHostgroupDependent').val() !== null) {
            $('#HostdependencyHostgroup').children().each(function(intKey, OptionObject) {
                if (in_array(OptionObject.value, $('#HostdependencyHostgroupDependent').val())) {
                    $OptionObject = $(OptionObject);
                    $OptionObject.prop('disabled', !0)
                }
            });
            $('#HostdependencyHostgroupDependent').children().each(function(intKey, OptionObject) {
                if (in_array(OptionObject.value, $('#HostdependencyHostgroup').val())) {
                    $OptionObject = $(OptionObject);
                    $OptionObject.prop('disabled', !0)
                }
            });
            $('#HostdependencyHostgroup').trigger("chosen:updated");
            $('#HostdependencyHostgroupDependent').trigger("chosen:updated")
        }
    },
    refreshHosts: function(selected_hosts, selectboxObject, target) {
        for (var key in selected_hosts) {
            $(target).children().each(function(intKey, OptionObject) {
                $OptionObject = $(OptionObject);
                if ($OptionObject.val() == selected_hosts[key]) {
                    if (!$OptionObject.prop('disabled')) {
                        $OptionObject.prop('disabled', !0)
                    }
                }
            })
        }
        var targetValue = $(target).val();
        $(target).children().each(function(intKey, OptionObject) {
            $OptionObject = $(OptionObject);
            if (targetValue == null) {
                targetValue = []
            }
            if (selected_hosts == null) {
                selected_hosts = []
            }
            if (!in_array($OptionObject.val(), selected_hosts) && !in_array($OptionObject.val(), targetValue)) {
                if ($OptionObject.prop('disabled')) {
                    $OptionObject.prop('disabled', null)
                }
            }
        });
        $(target).trigger("chosen:updated")
    }
});
App.Controllers.InstantreportsAddController = Frontend.AppController.extend({
    _initialize: function() {
        var self = this;
        $(document).on('click', '.group-result', function() {
            var unselected = $(this).nextUntil('.group-result').not('.result-selected');
            if (unselected.length) {
                unselected.trigger('mouseup')
            } else {
                $(this).nextUntil('.group-result').each(function() {
                    $('a.search-choice-close[data-option-array-index="' + $(this).data('option-array-index') + '"]').trigger('click')
                })
            }
        });
        $('#InstantreportType').change(function() {
            self.changeInputFieldsByType()
        });
        self.changeInputFieldsByType();
        $('#InstantreportSendEmail').change(function() {
            self.changeSendMail()
        });
        self.changeSendMail();
        self.$tagsinput = $('.tagsinput');
        self.$tagsinput.tagsinput()
    },
    changeInputFieldsByType: function() {
        $('.select-type').hide();
        $('.select-type-' + $('#InstantreportType').val()).show()
    },
    changeSendMail: function() {
        if ($('#InstantreportSendEmail').is(':checked')) {
            $('.send-interval-holder').show()
        } else {
            $('.send-interval-holder').hide()
        }
    }
});
App.Controllers.InstantreportsGenerateController = Frontend.AppController.extend({
    _initialize: function() {
        var self = this;
        $("#InstantreportStartDate").datepicker({
            changeMonth: !0,
            numberOfMonths: 3,
            todayHighlight: !0,
            weekStart: 1,
            calendarWeeks: !0,
            autoclose: !0,
            format: 'dd.mm.yyyy',
            prevText: '<i class="fa fa-chevron-left"></i>',
            nextText: '<i class="fa fa-chevron-right"></i>'
        });
        $("#InstantreportEndDate").datepicker({
            changeMonth: !0,
            numberOfMonths: 3,
            todayHighlight: !0,
            weekStart: 1,
            calendarWeeks: !0,
            autoclose: !0,
            format: 'dd.mm.yyyy',
            prevText: '<i class="fa fa-chevron-left"></i>',
            nextText: '<i class="fa fa-chevron-right"></i>'
        })
    }
});
App.Controllers.InstantreportsEditController = Frontend.AppController.extend({
    _initialize: function() {
        var self = this;
        $(document).on('click', '.group-result', function() {
            var unselected = $(this).nextUntil('.group-result').not('.result-selected');
            if (unselected.length) {
                unselected.trigger('mouseup')
            } else {
                $(this).nextUntil('.group-result').each(function() {
                    $('a.search-choice-close[data-option-array-index="' + $(this).data('option-array-index') + '"]').trigger('click')
                })
            }
        });
        $('#InstantreportType').change(function() {
            self.changeInputFieldsByType()
        });
        self.changeInputFieldsByType();
        $('#InstantreportSendEmail').change(function() {
            self.changeSendMail()
        });
        self.changeSendMail()
    },
    changeInputFieldsByType: function() {
        $('.select-type').hide();
        $('.select-type-' + $('#InstantreportType').val()).show()
    },
    changeSendMail: function() {
        if ($('#InstantreportSendEmail').is(':checked')) {
            $('.send-interval-holder').show();
            $('.generate-submit-class').hide()
        } else {
            $('.send-interval-holder').hide()
        }
    }
});
App.Controllers.HostescalationsEditController = Frontend.AppController.extend({
    components: ['Ajaxloader', 'ContainerSelectbox'],
    _initialize: function() {
        var self = this;
        this.Ajaxloader.setup();
        this.ContainerSelectbox.setup(this.Ajaxloader);
        this.ContainerSelectbox.addContainerEventListener({
            selectBoxSelector: '#HostescalationContainerId',
            event: 'change.hostContainer',
            ajaxUrl: '/Hostescalations/loadElementsByContainerId/:selectBoxValue:.json',
            fieldTypes: {
                hosts: '#HostescalationHost',
                hostsExcluded: '#HostescalationHostExcluded',
                hostgroups: '#HostescalationHostgroup',
                hostgroupsExcluded: '#HostescalationHostgroupExcluded',
                timeperiods: '#HostescalationTimeperiodId',
                contacts: '#HostescalationContact',
                contactgroups: '#HostescalationContactgroup'
            },
            dataPlaceholderEmpty: self.getVar('data_placeholder_empty'),
            dataPlaceholder: self.getVar('data_placeholder')
        });
        $('[id^=HostescalationHost]').change(function() {
            $this = $(this);
            self.refreshHosts($this.val(), $this, $this.attr('target'))
        });
        if ($('#HostescalationHost').val() !== null || $('#HostescalationHostExcluded').val() !== null) {
            $('#HostescalationHost').children().each(function(intKey, OptionObject) {
                if (in_array(OptionObject.value, $('#HostescalationHostExcluded').val())) {
                    $OptionObject = $(OptionObject);
                    $OptionObject.prop('disabled', !0)
                }
            });
            $('#HostescalationHostExcluded').children().each(function(intKey, OptionObject) {
                if (in_array(OptionObject.value, $('#HostescalationHost').val())) {
                    $OptionObject = $(OptionObject);
                    $OptionObject.prop('disabled', !0)
                }
            });
            $('#HostescalationHost').trigger("chosen:updated");
            $('#HostescalationHostExcluded').trigger("chosen:updated")
        }
        if ($('#HostescalationHostgroup').val() !== null || $('#HostescalationHostgroupExcluded').val() !== null) {
            $('#HostescalationHostgroup').children().each(function(intKey, OptionObject) {
                if (in_array(OptionObject.value, $('#HostescalationHostgroupExclude').val())) {
                    $OptionObject = $(OptionObject);
                    $OptionObject.prop('disabled', !0)
                }
            });
            $('#HostescalationHostgroupExcluded').children().each(function(intKey, OptionObject) {
                if (in_array(OptionObject.value, $('#HostescalationHostgroup').val())) {
                    $OptionObject = $(OptionObject);
                    $OptionObject.prop('disabled', !0)
                }
            });
            $('#HostescalationHostgroup').trigger("chosen:updated");
            $('#HostescalationHostgroupExcluded').trigger("chosen:updated")
        }
    },
    refreshHosts: function(selected_hosts, selectboxObject, target) {
        for (var key in selected_hosts) {
            $(target).children().each(function(intKey, OptionObject) {
                $OptionObject = $(OptionObject);
                if ($OptionObject.val() == selected_hosts[key]) {
                    if (!$OptionObject.prop('disabled')) {
                        $OptionObject.prop('disabled', !0)
                    }
                }
            })
        }
        var targetValue = $(target).val();
        $(target).children().each(function(intKey, OptionObject) {
            $OptionObject = $(OptionObject);
            if (targetValue == null) {
                targetValue = []
            }
            if (selected_hosts == null) {
                selected_hosts = []
            }
            if (!in_array($OptionObject.val(), selected_hosts) && !in_array($OptionObject.val(), targetValue)) {
                if ($OptionObject.prop('disabled')) {
                    $OptionObject.prop('disabled', null)
                }
            }
        });
        $(target).trigger("chosen:updated")
    }
});
App.Controllers.HostescalationsAddController = Frontend.AppController.extend({
    components: ['Ajaxloader', 'ContainerSelectbox'],
    _initialize: function() {
        this.Ajaxloader.setup();
        var self = this;
        this.ContainerSelectbox.setup(this.Ajaxloader);
        this.ContainerSelectbox.addContainerEventListener({
            selectBoxSelector: '#HostescalationContainerId',
            event: 'change.hostContainer',
            ajaxUrl: '/Hostescalations/loadElementsByContainerId/:selectBoxValue:.json',
            fieldTypes: {
                hosts: '#HostescalationHost',
                hostsExcluded: '#HostescalationHostExcluded',
                hostgroups: '#HostescalationHostgroup',
                hostgroupsExcluded: '#HostescalationHostgroupExcluded',
                timeperiods: '#HostescalationTimeperiodId',
                contacts: '#HostescalationContact',
                contactgroups: '#HostescalationContactgroup'
            },
            dataPlaceholderEmpty: self.getVar('data_placeholder_empty'),
            dataPlaceholder: self.getVar('data_placeholder')
        });
        $('[id^=HostescalationHost]').change(function() {
            $this = $(this);
            self.refreshHosts($this.val(), $this, $this.attr('target'))
        });
        if ($('#HostescalationHost').val() !== null || $('#HostescalationHostExcluded').val() !== null) {
            $('#HostescalationHost').children().each(function(intKey, OptionObject) {
                if (in_array(OptionObject.value, $('#HostescalationHostExcluded').val())) {
                    $OptionObject = $(OptionObject);
                    $OptionObject.prop('disabled', !0)
                }
            });
            $('#HostescalationHostExcluded').children().each(function(intKey, OptionObject) {
                if (in_array(OptionObject.value, $('#HostescalationHost').val())) {
                    $OptionObject = $(OptionObject);
                    $OptionObject.prop('disabled', !0)
                }
            });
            $('#HostescalationHost').trigger("chosen:updated");
            $('#HostescalationHostExcluded').trigger("chosen:updated")
        }
        if ($('#HostescalationHostgroup').val() !== null || $('#HostescalationHostgroupExcluded').val() !== null) {
            $('#HostescalationHostgroup').children().each(function(intKey, OptionObject) {
                if (in_array(OptionObject.value, $('#HostescalationHostgroupExclude').val())) {
                    $OptionObject = $(OptionObject);
                    $OptionObject.prop('disabled', !0)
                }
            });
            $('#HostescalationHostgroupExcluded').children().each(function(intKey, OptionObject) {
                if (in_array(OptionObject.value, $('#HostescalationHostgroup').val())) {
                    $OptionObject = $(OptionObject);
                    $OptionObject.prop('disabled', !0)
                }
            });
            $('#HostescalationHostgroup').trigger("chosen:updated");
            $('#HostescalationHostgroupExcluded').trigger("chosen:updated")
        }
    },
    refreshHosts: function(selected_hosts, selectboxObject, target) {
        for (var key in selected_hosts) {
            $(target).children().each(function(intKey, OptionObject) {
                $OptionObject = $(OptionObject);
                if ($OptionObject.val() == selected_hosts[key]) {
                    if (!$OptionObject.prop('disabled')) {
                        $OptionObject.prop('disabled', !0)
                    }
                }
            })
        }
        var targetValue = $(target).val();
        $(target).children().each(function(intKey, OptionObject) {
            $OptionObject = $(OptionObject);
            if (targetValue == null) {
                targetValue = []
            }
            if (selected_hosts == null) {
                selected_hosts = []
            }
            if (!in_array($OptionObject.val(), selected_hosts) && !in_array($OptionObject.val(), targetValue)) {
                if ($OptionObject.prop('disabled')) {
                    $OptionObject.prop('disabled', null)
                }
            }
        });
        $(target).trigger("chosen:updated")
    }
});
App.Controllers.ServicetemplatesAddController = Frontend.AppController.extend({
    $contacts: null,
    $contactgroups: null,
    $servicegroups: null,
    components: ['Highlight', 'Ajaxloader', 'CustomVariables', 'ContainerSelectbox'],
    _initialize: function() {
        var self = this;
        this.Ajaxloader.setup();
        this.CustomVariables.setup({
            controller: 'Servicetemplates',
            ajaxUrl: 'addCustomMacro',
            macrotype: 'SERVICE'
        });
        this.ContainerSelectbox.setup(this.Ajaxloader);
        this.ContainerSelectbox.addContainerEventListener({
            selectBoxSelector: '#ServicetemplateContainerId',
            ajaxUrl: '/Servicetemplates/loadElementsByContainerId/:selectBoxValue:.json',
            fieldTypes: {
                timeperiods: '#ServicetemplateNotifyPeriodId',
                checkperiods: '#ServicetemplateCheckPeriodId',
                contacts: '#ServicetemplateContact',
                contactgroups: '#ServicetemplateContactgroup',
                servicegroups: '#ServicetemplateServicegroup'
            },
            dataPlaceholderEmpty: self.getVar('data_placeholder_empty'),
            dataPlaceholder: self.getVar('data_placeholder')
        });
        $("[data-toggle='tab']").click(function() {
            $('.chosen-container').css('width', '100%')
        });
        this.$contacts = $('#ContactContact');
        this.$contactgroups = $('#ContactgroupContactgroup');
        this.$servicegroups = $('#ServicegroupServicegroup');
        $('input[type="checkbox"]#ServicetemplateFlapDetectionEnabled').change(function() {
            self.checkFlapDetection()
        });
        this.checkFlapDetection();
        this.checkFreshnessSettings();
        $('input[type="checkbox"]#ServicetemplateFreshnessChecksEnabled').change(function() {
            self.checkFreshnessSettings()
        });
        this.checkFreshnessSettings();
        self.lang = [];
        self.lang[1] = this.getVar('lang_minutes');
        self.lang[2] = this.getVar('lang_seconds');
        self.lang[3] = this.getVar('lang_and');
        var onSlideStop = function(ev) {
            if (ev.value == null) {
                ev.value = 0
            }
            $('#_' + $(this).attr('id')).val(ev.value);
            $(this).val(ev.value).trigger('change');
            var min = parseInt(ev.value / 60, 10);
            var sec = parseInt(ev.value % 60, 10);
            $($(this).attr('human')).html(min + " " + self.lang[1] + " " + self.lang[3] + " " + sec + " " + self.lang[2])
        };
        var $slider = $('input.slider');
        $slider.slider({
            tooltip: 'hide'
        });
        $slider.slider('on', 'slide', onSlideStop);
        $slider.slider('on', 'slideStop', onSlideStop);
        var onChangeSliderInput = function() {
            var $this = $(this);
            $('#' + $this.attr('slider-for')).slider('setValue', parseInt($this.val(), 10), !0).val($this.val()).attr('value', $this.val());
            var min = parseInt($this.val() / 60, 10);
            var sec = parseInt($this.val() % 60, 10);
            $($this.attr('human')).html(min + " " + self.lang[1] + " " + self.lang[3] + " " + sec + " " + self.lang[2])
        };
        $('.slider-input').on('change.slider', onChangeSliderInput);
        $('.tagsinput').tagsinput();
        self.loadParameters($('#ServicetemplateCommandId').val(), $('#CheckCommandArgs'));
        $('#ServicetemplateCommandId').change(function() {
            self.loadParameters($(this).val(), $('#CheckCommandArgs'))
        });
        self.loadNagParameters($('#ServicetemplateEventhandlerCommandId').val(), $('#EventhandlerCommandArgs'));
        $('#ServicetemplateEventhandlerCommandId').change(function() {
            self.loadNagParameters($(this).val(), $('#EventhandlerCommandArgs'))
        })
    },
    checkFlapDetection: function() {
        var disable = null;
        if (!$('input[type="checkbox"]#ServicetemplateFlapDetectionEnabled').prop('checked')) {
            disable = !0
        }
        $('.flapdetection_control').prop('disabled', disable)
    },
    checkFreshnessSettings: function() {
        var readonly = null;
        if (!$('input[type="checkbox"]#ServicetemplateFreshnessChecksEnabled').prop('checked')) {
            readonly = !0;
            $('#ServicetemplateFreshnessThreshold').val('')
        }
        $('#ServicetemplateFreshnessThreshold').prop('readonly', readonly)
    },
    loadParameters: function(command_id, $target) {
        this.Ajaxloader.show();
        $.ajax({
            url: "/Servicetemplates/loadArgumentsAdd/" + encodeURIComponent(command_id),
            type: "POST",
            cache: !1,
            error: function() {},
            success: function() {},
            complete: function(response) {
                $target.html(response.responseText);
                this.Ajaxloader.hide()
            }.bind(this)
        })
    },
    loadNagParameters: function(command_id, $target) {
        this.Ajaxloader.show();
        $.ajax({
            url: "/Servicetemplates/loadNagArgumentsAdd/" + encodeURIComponent(command_id),
            type: "POST",
            cache: !1,
            error: function() {},
            success: function() {},
            complete: function(response) {
                $target.html(response.responseText);
                this.Ajaxloader.hide()
            }.bind(this)
        })
    }
});
App.Controllers.ServicetemplatesAssignGroupController = Frontend.AppController.extend({
    $table: null,
    _initialize: function() {
        var self = this;
        $('#new-stgroup').change(function() {
            self.checkCheckBox()
        });
        self.checkCheckBox()
    },
    checkCheckBox: function() {
        if ($('#new-stgroup').prop('checked')) {
            $('#new-to-holder').show();
            $('#assign-to-holder').hide()
        } else {
            $('#assign-to-holder').show();
            $('#new-to-holder').hide()
        }
    }
});
App.Controllers.ServicetemplatesEditController = Frontend.AppController.extend({
    $contacts: null,
    $contactgroups: null,
    $servicegroups: null,
    components: ['Highlight', 'Ajaxloader', 'CustomVariables', 'ContainerSelectbox'],
    _initialize: function() {
        var self = this;
        self.Ajaxloader.setup();
        self.CustomVariables.setup({
            controller: 'Servicetemplates',
            ajaxUrl: 'Servicetemplates/addCustomMacro',
            macrotype: 'SERVICE'
        });
        this.ContainerSelectbox.setup(this.Ajaxloader);
        this.ContainerSelectbox.addContainerEventListener({
            selectBoxSelector: '#ServicetemplateContainerId',
            ajaxUrl: '/Servicetemplates/loadElementsByContainerId/:selectBoxValue:.json',
            fieldTypes: {
                timeperiods: '#ServicetemplateNotifyPeriodId',
                checkperiods: '#ServicetemplateCheckPeriodId',
                contacts: '#ServicetemplateContact',
                contactgroups: '#ServicetemplateContactgroup',
                servicegroups: '#ServicetemplateServicegroup'
            },
            dataPlaceholderEmpty: self.getVar('data_placeholder_empty'),
            dataPlaceholder: self.getVar('data_placeholder')
        });
        $("[data-toggle='tab']").click(function() {
            $('.chosen-container').css('width', '100%')
        });
        this.$contacts = $('#ContactContact');
        this.$contactgroups = $('#ContactgroupContactgroup');
        this.$servicegroups = $('#ServicegroupServicegroup');
        $('input[type="checkbox"]#ServicetemplateFlapDetectionEnabled').change(function() {
            self.checkFlapDetection()
        });
        self.checkFlapDetection();
        $('input[type="checkbox"]#ServicetemplateFreshnessChecksEnabled').change(function() {
            self.checkFreshnessSettings()
        });
        self.checkFreshnessSettings();
        self.lang = [];
        self.lang[1] = this.getVar('lang_minutes');
        self.lang[2] = this.getVar('lang_seconds');
        self.lang[3] = this.getVar('lang_and');
        var onSlideStop = function(ev) {
            if (ev.value == null) {
                ev.value = 0
            }
            $('#_' + $(this).attr('id')).val(ev.value);
            $(this).val(ev.value).trigger('change');
            var min = parseInt(ev.value / 60, 10);
            var sec = parseInt(ev.value % 60, 10);
            $($(this).attr('human')).html(min + " " + self.lang[1] + " " + self.lang[3] + " " + sec + " " + self.lang[2])
        };
        var $slider = $('input.slider');
        $slider.slider({
            tooltip: 'hide'
        });
        $slider.slider('on', 'slide', onSlideStop);
        $slider.slider('on', 'slideStop', onSlideStop);
        var onChangeSliderInput = function() {
            var $this = $(this);
            $('#' + $this.attr('slider-for')).slider('setValue', parseInt($this.val(), 10), !0).val($this.val()).attr('value', $this.val());
            $serviceNotificationIntervalField.trigger('change');
            var min = parseInt($this.val() / 60, 10);
            var sec = parseInt($this.val() % 60, 10);
            $($this.attr('human')).html(min + " " + self.lang[1] + " " + self.lang[3] + " " + sec + " " + self.lang[2])
        };
        $('.slider-input').on('change.slider', onChangeSliderInput);
        $('.tagsinput').tagsinput();
        $('#ServicetemplateCommandId').change(function() {
            self.loadParametersByCommandId($(this).val(), $('#ServicetemplateId').val(), $('#CheckCommandArgs'))
        });
        var $servicetemplateEventhandlerCommandId = $('#ServicetemplateEventhandlerCommandId'),
            $event_handler_command_args = $('#EventhandlerCommandArgs'),
            loadEventhandlerArgs = function(id) {
                if (id && id != '0' && id > 0) {
                    self.loadNagParametersByCommandId(id, $('#ServicetemplateId').val(), $event_handler_command_args)
                } else {
                    $event_handler_command_args.html('')
                }
            };
        loadEventhandlerArgs($servicetemplateEventhandlerCommandId.val());
        $servicetemplateEventhandlerCommandId.on('change.commandId', function() {
            var id = $(this).val();
            loadEventhandlerArgs(id)
        })
    },
    checkFlapDetection: function() {
        var disable = null;
        if (!$('input[type="checkbox"]#ServicetemplateFlapDetectionEnabled').prop('checked')) {
            disable = !0
        }
        $('.flapdetection_control').prop('disabled', disable)
    },
    checkFreshnessSettings: function() {
        var readonly = null;
        if (!$('input[type="checkbox"]#ServicetemplateFreshnessChecksEnabled').prop('checked')) {
            readonly = !0;
            $('#ServicetemplateFreshnessThreshold').val('')
        }
        $('#ServicetemplateFreshnessThreshold').prop('readonly', readonly)
    },
    loadParameters: function(command_id, $target) {
        this.Ajaxloader.show();
        $.ajax({
            url: "/Servicetemplates/loadArgumentsAdd/" + encodeURIComponent(command_id),
            type: "POST",
            cache: !1,
            error: function() {},
            success: function() {},
            complete: function(response) {
                $target.html(response.responseText);
                this.Ajaxloader.hide()
            }.bind(this)
        })
    },
    loadParametersByCommandId: function(command_id, servicetemplate_id, $target) {
        var self = this;
        this.Ajaxloader.show();
        $.ajax({
            url: "/Servicetemplates/loadParametersByCommandId/" + encodeURIComponent(command_id) + "/" + encodeURIComponent(servicetemplate_id),
            type: "POST",
            cache: !1,
            error: function() {},
            success: function() {},
            complete: function(response) {
                $target.html(response.responseText);
                self.Ajaxloader.hide()
            }
        })
    },
    loadNagParametersByCommandId: function(command_id, servicetemplate_id, $target) {
        var self = this;
        this.Ajaxloader.show();
        $.ajax({
            url: "/Servicetemplates/loadNagParametersByCommandId/" + encodeURIComponent(command_id) + "/" + encodeURIComponent(servicetemplate_id),
            type: "POST",
            cache: !1,
            error: function() {},
            success: function() {},
            complete: function(response) {
                $target.html(response.responseText);
                self.Ajaxloader.hide()
            }
        })
    }
});
App.Controllers.ServicetemplatesIndexController = Frontend.AppController.extend({
    $table: null,
    components: ['Masschange'],
    _initialize: function() {
        var self = this;
        this.Masschange.setup({
            'controller': 'servicetemplates',
            'group': 'servicetemplategroups'
        });
        $('#allocate-servicet').click(function(e) {
            var containerId = '';
            $('.massChange').each(function() {
                if (this.checked) {
                    if (containerId == '') {
                        containerId = $(this).attr('data-container')
                    } else if (containerId != $(this).attr('data-container')) {
                        alert($('#same-contaner-text').val());
                        e.preventDefault();
                        return
                    }
                }
            })
        });
        $('#new-stgroup').click(function() {
            alert('suka')
        })
    }
});
App.Controllers.HosttemplatesAddController = Frontend.AppController.extend({
    $contacts: null,
    $contactgroups: null,
    components: ['Highlight', 'Ajaxloader', 'CustomVariables', 'ContainerSelectbox'],
    _initialize: function() {
        var self = this;
        this.Ajaxloader.setup();
        this.CustomVariables.setup({
            controller: 'Hosttemplates',
            ajaxUrl: 'addCustomMacro',
            macrotype: 'HOST'
        });
        this.$contacts = $('#ContactContact');
        this.$contactgroups = $('#ContactgroupContactgroup');
        this.ContainerSelectbox.setup(this.Ajaxloader);
        this.ContainerSelectbox.addContainerEventListener({
            selectBoxSelector: '#HosttemplateContainerId',
            ajaxUrl: '/Hosttemplates/loadElementsByContainerId/:selectBoxValue:.json',
            fieldTypes: {
                timeperiods: '#HosttemplateNotifyPeriodId',
                checkperiods: '#HosttemplateCheckPeriodId',
                contacts: '#HosttemplateContact',
                contactgroups: '#HosttemplateContactgroup',
                hostgroups: '#HosttemplateHostgroup'
            },
            dataPlaceholderEmpty: self.getVar('data_placeholder_empty'),
            dataPlaceholder: self.getVar('data_placeholder')
        });
        $("[data-toggle='tab']").on('click', function() {
            $('.chosen-container').css('width', '100%')
        });
        $('input[type="checkbox"]#HosttemplateFlapDetectionEnabled').change(function() {
            this.checkFlapDetection()
        }.bind(this));
        this.checkFlapDetection();
        self.lang = [];
        self.lang[1] = this.getVar('lang_minutes');
        self.lang[2] = this.getVar('lang_seconds');
        self.lang[3] = this.getVar('lang_and');
        var onSlideStop = function(ev) {
            if (ev.value == null) {
                ev.value = 0
            }
            $('#_' + $(this).attr('id')).val(ev.value);
            $(this).val(ev.value).trigger('change');
            var min = parseInt(ev.value / 60, 10);
            var sec = parseInt(ev.value % 60, 10);
            $($(this).attr('human')).html(min + " " + self.lang[1] + " " + self.lang[3] + " " + sec + " " + self.lang[2])
        };
        var $slider = $('input.slider');
        $slider.slider({
            tooltip: 'hide'
        });
        $slider.slider('on', 'slide', onSlideStop);
        $slider.slider('on', 'slideStop', onSlideStop);
        var onChangeSliderInput = function() {
            var $this = $(this);
            $('#' + $this.attr('slider-for')).slider('setValue', parseInt($this.val(), 10), !0).val($this.val()).attr('value', $this.val());
            var min = parseInt($this.val() / 60, 10);
            var sec = parseInt($this.val() % 60, 10);
            $($this.attr('human')).html(min + " " + self.lang[1] + " " + self.lang[3] + " " + sec + " " + self.lang[2])
        };
        $('.slider-input').on('change.slider', onChangeSliderInput);
        $('.tagsinput').tagsinput();
        $('#HosttemplateCommandId').change(function() {
            self.loadParameters($(this).val())
        })
    },
    checkFlapDetection: function() {
        var disable = null;
        if (!$('input[type="checkbox"]#HosttemplateFlapDetectionEnabled').prop('checked')) {
            disable = !0
        }
        $('.flapdetection_control').prop('disabled', disable)
    },
    loadParameters: function(command_id) {
        this.Ajaxloader.show();
        $.ajax({
            url: "/Hosttemplates/loadArgumentsAdd/" + encodeURIComponent(command_id),
            type: "POST",
            cache: !1,
            error: function() {},
            success: function() {},
            complete: function(response) {
                $('#CheckCommandArgs').html(response.responseText);
                this.Ajaxloader.hide()
            }.bind(this)
        })
    }
});
App.Controllers.HosttemplatesEditController = Frontend.AppController.extend({
    $contacts: null,
    $contactgroups: null,
    components: ['Highlight', 'Ajaxloader', 'CustomVariables', 'ContainerSelectbox'],
    _initialize: function() {
        var self = this;
        this.Ajaxloader.setup();
        this.CustomVariables.setup({
            controller: 'Hosttemplates',
            ajaxUrl: 'addCustomMacro',
            macrotype: 'HOST'
        });
        this.ContainerSelectbox.setup(this.Ajaxloader);
        this.ContainerSelectbox.addContainerEventListener({
            selectBoxSelector: '#HosttemplateContainerId',
            ajaxUrl: '/Hosttemplates/loadElementsByContainerId/:selectBoxValue:.json',
            fieldTypes: {
                timeperiods: '#HosttemplateNotifyPeriodId',
                checkperiods: '#HosttemplateCheckPeriodId',
                contacts: '#HosttemplateContact',
                contactgroups: '#HosttemplateContactgroup',
                hostgroups: '#HosttemplateHostgroup'
            },
            dataPlaceholderEmpty: self.getVar('data_placeholder_empty'),
            dataPlaceholder: self.getVar('data_placeholder')
        });
        this.$contacts = $('#ContactContact');
        this.$contactgroups = $('#ContactgroupContactgroup');
        this.$hostgroups = $('#HostgroupHostgroup');
        $("[data-toggle='tab']").on('click', function() {
            $('.chosen-container').css('width', '100%')
        });
        $('input[type="checkbox"]#HosttemplateFlapDetectionEnabled').change(function() {
            self.checkFlapDetection()
        });
        this.checkFlapDetection();
        self.lang = [];
        self.lang[1] = this.getVar('lang_minutes');
        self.lang[2] = this.getVar('lang_seconds');
        self.lang[3] = this.getVar('lang_and');
        var onSlideStop = function(ev) {
            if (ev.value == null) {
                ev.value = 0
            }
            $('#_' + $(this).attr('id')).val(ev.value);
            $(this).val(ev.value).trigger('change');
            var min = parseInt(ev.value / 60, 10);
            var sec = parseInt(ev.value % 60, 10);
            $($(this).attr('human')).html(min + " " + self.lang[1] + " " + self.lang[3] + " " + sec + " " + self.lang[2])
        };
        var $slider = $('input.slider');
        $slider.slider({
            tooltip: 'hide'
        });
        $slider.slider('on', 'slide', onSlideStop);
        $slider.slider('on', 'slideStop', onSlideStop);
        var onChangeSliderInput = function() {
            var $this = $(this);
            $('#' + $this.attr('slider-for')).slider('setValue', parseInt($this.val(), 10), !0).val($this.val()).attr('value', $this.val());
            $serviceNotificationIntervalField.trigger('change');
            var min = parseInt($this.val() / 60, 10);
            var sec = parseInt($this.val() % 60, 10);
            $($this.attr('human')).html(min + " " + self.lang[1] + " " + self.lang[3] + " " + sec + " " + self.lang[2])
        };
        $('.slider-input').on('change.slider', onChangeSliderInput).on('keyup', function() {
            var $this = $(this);
            $('#' + $this.attr('slider-for')).slider('setValue', $this.val());
            min = parseInt($this.val() / 60);
            sec = parseInt($this.val() % 60);
            $($this.attr('human')).html(min + " " + lang[1] + " " + lang[3] + " " + sec + " " + lang[2])
        });
        $('.tagsinput').tagsinput();
        $('#HosttemplateCommandId').change(function() {
            self.loadParameters($(this).val())
        })
    },
    checkFlapDetection: function() {
        var disable = null;
        if (!$('input[type="checkbox"]#HosttemplateFlapDetectionEnabled').prop('checked')) {
            disable = !0
        }
        $('.flapdetection_control').prop('disabled', disable)
    },
    loadParameters: function(command_id) {
        this.Ajaxloader.show();
        $.ajax({
            url: "/Hosttemplates/loadArguments/" + encodeURIComponent(command_id) + "/" + this.getVar('hosttemplate_id'),
            type: "POST",
            cache: !1,
            error: function() {},
            success: function() {},
            complete: function(response) {
                $('#CheckCommandArgs').html(response.responseText);
                this.Ajaxloader.hide()
            }.bind(this)
        })
    }
});
App.Controllers.HosttemplatesIndexController = Frontend.AppController.extend({
    $table: null,
    components: ['Masschange'],
    _initialize: function() {
        var self = this;
        this.Masschange.setup({
            'controller': 'hosttemplates',
            'group': 'hosttemplategroups'
        })
    }
});
App.Controllers.QrIndexController = Frontend.AppController.extend({
    components: ['Qr'],
    _initialize: function() {
        this.Qr._printPage(this.getVar('qr_url'), this.getVar('qr_width'), this.getVar('qr_height'))
    }
});
App.Controllers.DowntimereportsIndexController = Frontend.AppController.extend({
    $hostDowntimes: null,
    $serviceDowntimes: null,
    components: ['Ajaxloader'],
    _initialize: function() {
        var self = this;
        $(document).on('click', '.group-result', function() {
            var unselected = $(this).nextUntil('.group-result').not('.result-selected');
            if (unselected.length) {
                unselected.trigger('mouseup')
            } else {
                $(this).nextUntil('.group-result').each(function() {
                    $('a.search-choice-close[data-option-array-index="' + $(this).data('option-array-index') + '"]').trigger('click')
                })
            }
        });
        $("#DowntimereportStartDate").datepicker({
            changeMonth: !0,
            numberOfMonths: 3,
            todayHighlight: !0,
            weekStart: 1,
            calendarWeeks: !0,
            autoclose: !0,
            format: 'dd.mm.yyyy',
            prevText: '<i class="fa fa-chevron-left"></i>',
            nextText: '<i class="fa fa-chevron-right"></i>',
        });
        $("#DowntimereportEndDate").datepicker({
            changeMonth: !0,
            numberOfMonths: 3,
            todayHighlight: !0,
            weekStart: 1,
            calendarWeeks: !0,
            autoclose: !0,
            format: 'dd.mm.yyyy',
            prevText: '<i class="fa fa-chevron-left"></i>',
            nextText: '<i class="fa fa-chevron-right"></i>',
        });
        if (this.getVar('downtimeReportDetails')) {
            var downtimeReportDetails = this.getVar('downtimeReportDetails');
            var evaluationStart = new Date(downtimeReportDetails.startDate);
            var evaluationEnd = new Date(downtimeReportDetails.endDate)
        }
        var hostDowntimes = [];
        if (this.getVar('hostDowntimes')) {
            $.each(this.getVar('hostDowntimes'), function(i, elem) {
                hostDowntimes.push({
                    title: elem.host,
                    start: elem.scheduled_start_time,
                    end: elem.scheduled_end_time,
                    description: '<i class="fa fa-user"></i> ' + elem.author_name + ' <br /><i class="fa fa-comment"></i> ' + elem.comment_data,
                    className: ["event", "bg-color-blue"],
                    icon: 'fa-desktop',
                    allDay: !1
                })
            })
        }
        var serviceDowntimes = [];
        if (this.getVar('serviceDowntimes')) {
            $.each(this.getVar('serviceDowntimes'), function(i, elem) {
                serviceDowntimes.push({
                    title: elem.host + ' | ' + elem.service,
                    start: elem.scheduled_start_time,
                    end: elem.scheduled_end_time,
                    description: '<i class="fa fa-user"></i> ' + elem.author_name + ' <br /><i class="fa fa-comment"></i> ' + elem.comment_data,
                    className: ["event", "bg-color-blueLight"],
                    icon: 'fa-gear',
                    allDay: !1
                })
            })
        }
        var events = $.merge($.merge([], hostDowntimes), serviceDowntimes);
        $('#calendar').fullCalendar({
            firstDay: 1,
            titleFormat: {
                day: 'DD.MM.YYYY',
                week: 'DD.MM.YYYY',
            },
            displayEventEnd: {
                month: !0,
                basicWeek: !0,
                "default": !0
            },
            timeFormat: 'DD.MM.YY h:mm',
            header: {
                left: 'title',
                center: 'month,agendaWeek,agendaDay',
                right: 'prev,today,next',
            },
            events: events,
            eventRender: function(event, element, icon) {
                if (event.description != "") {
                    var fcEventTitle = element.find('.fc-event-title').append("<br/><span class='ultra-light'>" + event.description + "</span>");
                    element.popover({
                        trigger: 'hover',
                        html: !0,
                        title: event.title,
                        placement: "auto left",
                        content: event.description
                    })
                }
                if (event.icon != "") {
                    element.find('.fc-event-title').append("<i class='air air-top-right fa " + event.icon + " '></i>")
                }
            },
            dayRender: function(date, cell) {
                if (date >= evaluationStart && date <= evaluationEnd) {
                    cell.addClass("evaluation-period")
                }
            },
            editable: !1,
            droppable: !1,
            axisFormat: 'H:mm',
        })
    },
});
App.Controllers.CurrentstatereportsCreateHtmlReportController = Frontend.AppController.extend({
    components: ['Ajaxloader'],
    _initialize: function() {
        var self = this;
        $(document).on('click', '.group-result', function() {
            var unselected = $(this).nextUntil('.group-result').not('.result-selected');
            if (unselected.length) {
                unselected.trigger('mouseup')
            } else {
                $(this).nextUntil('.group-result').each(function() {
                    $('a.search-choice-close[data-option-array-index="' + $(this).data('option-array-index') + '"]').trigger('click')
                })
            }
        });
        $('.perfdataContainerShowDetails').click(function() {
            self.showHidePerformanceDetails(this)
        });
        self.renderPerfdataMeter()
    },
    renderPerfdataMeter: function() {
        var self = this;
        $('.perfdataContainer').each(function() {
            $(this).css('background', self.createBackgroundForPerfdataMeter(this.attributes))
        })
    },
    createBackgroundForPerfdataMeter: function(attributes) {
        var background = 'none';
        if (!(attributes.min && attributes.current_value && attributes.warning && attributes.critical && attributes.min && attributes.max)) {
            return background
        }
        var linearGradientArray = ['to right'];
        var start = (attributes.min.value != "") ? attributes.min.value : 0;
        var end = (attributes.max.value != "") ? attributes.max.value : (attributes.critical.value != "") ? attributes.critical.value : 0;
        var currentValue = Number(attributes.current_value.value);
        var warningValue = Number(attributes.warning.value);
        var criticalValue = Number(attributes.critical.value);
        if (!isNaN(warningValue) && !isNaN(criticalValue) && warningValue < criticalValue) {
            var curValPosInPercent = currentValue / (end - start) * 100;
            curValPosInPercent = (curValPosInPercent > 100) ? 100 : curValPosInPercent;
            if ((!isNaN(warningValue) && currentValue >= warningValue) && (!isNaN(criticalValue) && currentValue < criticalValue)) {
                linearGradientArray.push('#5CB85C 0%', '#F0AD4E ' + curValPosInPercent + '%')
            } else if ((!isNaN(warningValue) && currentValue > warningValue) && (!isNaN(criticalValue) && currentValue >= criticalValue)) {
                linearGradientArray.push('#5CB85C 0%', '#F0AD4E ' + (warningValue / (end - start) * 100) + '%', '#D9534F ' + curValPosInPercent + '%')
            } else if (currentValue < warningValue) {
                linearGradientArray.push('#5CB85C ' + curValPosInPercent + '%')
            }
            if (curValPosInPercent > 0 && curValPosInPercent < 100) {
                linearGradientArray.push('#ffffff ' + curValPosInPercent + '%')
            }
        }
        return 'linear-gradient(' + linearGradientArray.join(', ') + ')'
    },
    showHidePerformanceDetails: function(element) {
        if ($(element).hasClass('fa-plus-square-o')) {
            $(element).removeClass('fa-plus-square-o').addClass('fa-minus-square-o');
            $('.' + $(element).attr('uuid')).removeClass('hidden')
        } else {
            $(element).removeClass('fa-minus-square-o').addClass('fa-plus-square-o');
            $('.' + $(element).attr('uuid')).addClass('hidden')
        }
    }
});
App.Controllers.AutomapsAddController = Frontend.AppController.extend({
    _initialize: function() {
        $('#AutomapFontSize').slider({
            tooltip: 'hide'
        }).on('slideStop', function(ev) {
            var fontsizes = {
                1: 'xx-small',
                2: 'x-small',
                3: 'small',
                4: 'medium',
                5: 'large',
                6: 'x-large',
                7: 'xx-large'
            };
            var sliderValue = $('#AutomapFontSize').slider('getValue');
            $('#fontExample').css('font-size', fontsizes[sliderValue])
        }.bind(this));
        $('#AutomapShowLabel').change(function() {
            if ($(this).is(':checked') === !0) {
                $('#fontExample').html('<span><i class="fa fa-square txt-color-greenLight"></i> Hostname/Servicedescription</span>')
            } else {
                $('#fontExample').html('<span><i class="fa fa-square txt-color-greenLight"></i></span>')
            }
        })
    }
});
App.Controllers.AutomapsEditController = Frontend.AppController.extend({
    _initialize: function() {
        $('#AutomapFontSize').slider({
            tooltip: 'hide'
        }).on('slideStop', function(ev) {
            var fontsizes = {
                1: 'xx-small',
                2: 'x-small',
                3: 'small',
                4: 'medium',
                5: 'large',
                6: 'x-large',
                7: 'xx-large'
            };
            var sliderValue = $('#AutomapFontSize').slider('getValue');
            $('#fontExample').css('font-size', fontsizes[sliderValue])
        }.bind(this));
        $('#AutomapShowLabel').change(function() {
            if ($(this).is(':checked') === !0) {
                $('#fontExample').html('<span><i class="fa fa-square txt-color-greenLight"></i> Hostname/Servicedescription</span>')
            } else {
                $('#fontExample').html('<span><i class="fa fa-square txt-color-greenLight"></i></span>')
            }
        })
    }
});
App.Controllers.MacrosIndexController = Frontend.AppController.extend({
    macroNames: null,
    limit: 256,
    components: ['Ajaxloader'],
    _initialize: function() {
        this.Ajaxloader.setup();
        var self = this;
        $('.addMacro').click(function() {
            this.addMacro();
            this.checkLimitReached()
        }.bind(this));
        $(document).on('click', '.deleteMacro', function() {
            $(this).parent().parent().remove();
            self.checkLimitReached();
            self.updateMacroNames()
        });
        $(document).on('click', '.isPassword', function() {
            $(this).children('i').toggleClass('fa-eye-slash fa-eye').promise().done(function() {
                this.parent().toggleClass('txt-color-red txt-color-blue');
                if (this.hasClass('fa-eye')) {
                    this.closest('tr').find('input.systemsetting-input[name*="value"]').each(function() {
                        $(this).addClass('macroPassword')
                    });
                    this.closest('tr').find('input:hidden[name*="password"]').each(function() {
                        $(this).val(1)
                    })
                } else {
                    this.closest('tr').find('input.systemsetting-input[name*="value"]').each(function() {
                        $(this).removeClass('macroPassword')
                    });
                    this.closest('tr').find('input:hidden[name*="password"]').each(function() {
                        $(this).val(0)
                    })
                }
            })
        })
    },
    addMacro: function() {
        this.Ajaxloader.show();
        this.updateMacroNames();
        this.$button = $('.addMacro');
        this.$button.prop('disabled', !0);
        $.ajax({
            url: "/Macros/addMacro/",
            type: "POST",
            cache: !1,
            data: this.macroNames,
            error: function() {},
            success: function() {},
            complete: function(response) {
                $('#macrosTable > tbody:last').append(response.responseText);
                this.Ajaxloader.hide();
                this.$button.prop('disabled', !1)
            }.bind(this)
        })
    },
    updateMacroNames: function() {
        this.macroNames = {};
        $("[macro='name']").each(function(intKey, nameObject) {
            this.macroNames[$(nameObject).attr('uuid')] = $(nameObject).val()
        }.bind(this))
    },
    checkLimitReached: function() {
        if ($('#macrosTable > tbody > tr').not().has('td[id!="limitReached"]').length >= this.limit) {
            $('#addNewMacro').hide()
        } else {
            $('#limitReached').parent().remove();
            $('#addNewMacro').show()
        }
    }
});
App.Controllers.BackupsIndexController = Frontend.AppController.extend({
    $exportLog: null,
    worker: null,
    components: ['Ajaxloader'],
    _initialize: function() {
        this.Ajaxloader.setup();
        var content = "";
        var finish = !0;
        var self = this;
        var error = !1;
        self.worker = function() {
            $.ajax({
                type: "GET",
                cache: !1,
                url: "/backups/checkBackupFinished.json",
                success: function(response) {
                    if (jQuery.type(response) === "string") {
                        $('#warningMessage').html("You have been restored an old Backup. You have to run openitcockpit-update and set the user rights correctly.");
                        $('#backupWarning').show()
                    } else {
                        var $backupLog = $('#backupLog');
                        if (response.backupFinished.finished == !1 && error == !1) {
                            setTimeout(self.worker, 1000);
                            var html = '<div data-finished="0"><i class="fa fa-spin fa-refresh"></i> <span>' + content + ' is running</span>';
                            $backupLog.html(html);
                            finish = !1
                        } else if (response.backupFinished.error == !0) {
                            var html = '<div data-finished="0"><i class="fa fa-close text-danger"></i> <span>' + content + ' has caused an error</span>';
                            $backupLog.html(html);
                            $('#errorMessage').html(content + " was not successfully finished");
                            $('#backupError').show();
                            finish = !0
                        } else if (error == !0) {
                            var html = '<div data-finished="0"><i class="fa fa-close text-danger"></i> <span>' + content + ' has caused an error</span>';
                            $backupLog.html(html);
                            finish = !0
                        } else {
                            var html = '<div data-finished="1"><i class="fa fa-check text-success"></i> <span>' + content + ' is finished</span>';
                            $backupLog.html(html);
                            $('#successMessage').html(content + " successfully done.");
                            $('#backupSuccessfully').show();
                            var backupfiles = $('#backupfile');
                            backupfiles.find('option').remove();
                            $.each(response.backupFinished.backup_files, function(val, text) {
                                backupfiles.append("<option value=" + val + ">" + text + "</option>")
                            });
                            finish = !0;
                            backupfiles.trigger("chosen:updated")
                        }
                    }
                },
                complete: function(response) {
                    var $backupLog = $('#backupLog');
                    if (jQuery.type(response) === "string") {
                        var html = '<div data-finished="1"><i class="fa fa-check text-success"></i> <span>' + content + ' is finished</span>';
                        $backupLog.html(html);
                        $('#warningMessage').html("You have been restored an old Backup. You have to run openitcockpit-update and set the user rights correctly.");
                        $('#backupWarning').show()
                    } else {
                        if (typeof response.backupFinished === 'undefined') {
                            console.log("LEER")
                        } else {
                            if (response.backupFinished.finished == !1 && error == !1) {
                                setTimeout(self.worker, 1000);
                                var html = '<div data-finished="0"><i class="fa fa-spin fa-refresh"></i> <span>' + content + ' is running</span>';
                                $backupLog.html(html);
                                finish = !1
                            } else if (response.backupFinished.error == !0) {
                                var html = '<div data-finished="0"><i class="fa fa-close text-danger"></i> <span>' + content + ' has caused an error</span>';
                                $backupLog.html(html);
                                $('#errorMessage').html(content + " was not successfully finished");
                                $('#backupError').show();
                                finish = !0
                            } else if (error == !0) {
                                var html = '<div data-finished="0"><i class="fa fa-close text-danger"></i> <span>' + content + ' has caused an error</span>';
                                $backupLog.html(html);
                                finish = !0
                            } else {
                                var html = '<div data-finished="1"><i class="fa fa-check text-success"></i> <span>' + content + ' is finished</span>';
                                $backupLog.html(html);
                                $('#successMessage').html(content + " successfully done.");
                                $('#backupSuccessfully').show();
                                var backupfiles = $('#backupfile');
                                backupfiles.find('option').remove();
                                $.each(response.backupFinished.backup_files, function(val, text) {
                                    backupfiles.append("<option value=" + val + ">" + text + "</option>")
                                });
                                finish = !0;
                                backupfiles.trigger("chosen:updated")
                            }
                        }
                    }
                }
            })
        }.bind(this);
        if (finish == !1 && error == !1) {
            self.worker()
        }
        $('#backup').click(function() {
            $('#backupSuccessfully').hide();
            $('#backupError').hide();
            $('#backupWarning').hide();
            $('#backupLog').empty();
            var fileForBackup = $('#filenameForBackup').val();
            content = "Backup";
            finish = !1;
            $.ajax({
                url: '/backups/backup.json',
                cache: !1,
                type: "GET",
                data: {
                    filename: fileForBackup
                },
                success: function(response) {
                    if (response.backup.error == !0) {
                        error = !0;
                        finish = !0;
                        $('#errorMessage').html("Backup was not successful. Your filename is invalid.");
                        $('#backupError').show()
                    } else {
                        self.worker()
                    }
                },
                complete: function() {}
            })
        }.bind(this));
        $('#restore').click(function() {
            $('#backupSuccessfully').hide();
            $('#backupError').hide();
            $('#backupWarning').hide();
            $('#backupLog').empty();
            var fileForBackup = $('#backupfile').val();
            var filenameParts = fileForBackup.split("/");
            var r = confirm("Are you sure to restore this backupfile " + filenameParts[5] + "?");
            if (r == !0) {
                finish = !1;
                content = "Restore";
                $.ajax({
                    url: '/backups/restore.json',
                    cache: !1,
                    type: "GET",
                    data: {
                        backupfile: fileForBackup
                    },
                    success: function(response) {
                        self.worker()
                    },
                    complete: function() {}
                })
            }
        }.bind(this));
        $('#delete').click(function() {
            $('#backupSuccessfully').hide();
            $('#backupError').hide();
            $('#backupWarning').hide();
            $('#backupLog').empty();
            var fileToDelete = $('#backupfile').val();
            var filenameParts = fileToDelete.split("/");
            var r = confirm("Are you sure to delete this backupfile " + filenameParts[5] + "?");
            if (r == !0) {
                $.ajax({
                    url: '/backups/deleteBackupFile.json',
                    cache: !1,
                    type: "GET",
                    data: {
                        fileToDelete: fileToDelete
                    },
                    success: function(response) {
                        if (response.success.result == !0) {
                            $('#successMessage').html("Backupfile " + filenameParts[5] + " successfully deleted.");
                            $('#backupSuccessfully').show();
                            var backupfiles = $('#backupfile');
                            backupfiles.find('option').remove();
                            $.each(response.success.backup_files, function(val, text) {
                                backupfiles.append("<option value=" + val + ">" + text + "</option>")
                            });
                            backupfiles.trigger("chosen:updated");
                            finish = !0
                        } else {
                            $('#errorMessage').html("Backupfile " + filenameParts[5] + " could not deleted.");
                            $('#backupError').show();
                            finish = !0
                        }
                    },
                    complete: function() {}
                })
            }
        }.bind(this))
    }
});
App.Controllers.ServicesAddController = Frontend.AppController.extend({
    $contacts: null,
    $contactgroups: null,
    $servicegroups: null,
    $tagsinput: null,
    lang: null,
    components: ['Highlight', 'Ajaxloader', 'CustomVariables', 'ContainerSelectbox'],
    _initialize: function() {
        var self = this;
        this.selectedHostId = this.getVar('hostId');
        this.Ajaxloader.setup();
        this.ContainerSelectbox.setup(this.Ajaxloader);
        this.ContainerSelectbox.addContainerEventListener({
            selectBoxSelector: '#ServiceHostId',
            event: 'change.serviceHost',
            ajaxUrl: '/services/loadElementsByHostId/:selectBoxValue:.json',
            fieldTypes: {
                timeperiods: '#ServiceNotifyPeriodId',
                checkperiods: '#ServiceCheckPeriodId',
                contacts: '#ServiceContact',
                contactgroups: '#ServiceContactgroup',
                servicegroups: '#ServiceServicegroup',
                servicetemplates: '#ServiceServicetemplateId'
            },
            dataPlaceholderEmpty: self.getVar('data_placeholder_empty'),
            dataPlaceholder: self.getVar('data_placeholder')
        });
        this.CustomVariables.setup({
            controller: 'Services',
            ajaxUrl: 'addCustomMacro',
            macrotype: 'SERVICE',
            onClick: function() {
                self.servicetemplateManager._onChangeMacro();
                self.servicetemplateManager._activateOrUpdateMacroRestore()
            }
        });
        $("[data-toggle='tab']").click(function() {
            $('.chosen-container').css('width', '100%')
        });
        this.$contacts = $('#ServiceContact');
        this.$contactgroups = $('#ServiceContactgroup');
        this.$servicegroups = $('#ServiceServicegroup');
        this.lang = [];
        this.lang[1] = this.getVar('lang_minutes');
        this.lang[2] = this.getVar('lang_seconds');
        this.lang[3] = this.getVar('lang_and');
        this.fieldMap = {};
        this.fieldMap.description = 'Description';
        this.fieldMap.notes = 'Notes';
        this.fieldMap.max_check_attempts = 'MaxCheckAttempts';
        this.fieldMap.name = 'Name';
        this.fieldMap.command_id = 'CommandId';
        this.fieldMap.notify_period_id = 'NotifyPeriodId';
        this.fieldMap.check_period_id = 'CheckPeriodId';
        this.fieldMap.notify_on_recovery = 'NotifyOnRecovery';
        this.fieldMap.notify_on_warning = 'NotifyOnWarning';
        this.fieldMap.notify_on_unknown = 'NotifyOnUnknown';
        this.fieldMap.notify_on_critical = 'NotifyOnCritical';
        this.fieldMap.notify_on_flapping = 'NotifyOnFlapping';
        this.fieldMap.notify_on_downtime = 'NotifyOnDowntime';
        this.fieldMap.flap_detection_enabled = 'FlapDetectionEnabled';
        this.fieldMap.flap_detection_on_ok = 'FlapDetectionOnOk';
        this.fieldMap.flap_detection_on_warning = 'FlapDetectionOnWarning';
        this.fieldMap.flap_detection_on_unknown = 'FlapDetectionOnUnknown';
        this.fieldMap.flap_detection_on_critical = 'FlapDetectionOnCritical';
        this.fieldMap.is_volatile = 'IsVolatile';
        this.fieldMap.freshness_checks_enabled = 'FreshnessChecksEnabled';
        this.fieldMap.freshness_threshold = 'FreshnessThreshold';
        this.fieldMap.command_id = 'CommandId';
        this.fieldMap.eventhandler_command_id = 'EventhandlerCommandId';
        this.fieldMap.process_performance_data = 'ProcessPerformanceData';
        this.fieldMap.active_checks_enabled = 'ActiveChecksEnabled';
        this.fieldMap.check_interval = 'Checkinterval';
        this.fieldMap.retry_interval = 'Retryinterval';
        this.fieldMap.notification_interval = 'Notificationinterval';
        this.fieldMap.tags = 'Tags';
        this.fieldMap.priority = 'stars-rating-5';
        this.fieldMap.contact = 'Contact';
        this.fieldMap.contactgroup = 'Contactgroup';
        this.fieldMap.servicegroup = 'Servicegroup';
        this.$tagsinput = $('.tagsinput');
        this.$tagsinput.tagsinput();
        this.loadInitialData('#ServiceHostId');
        var ChosenAjaxObj = new ChosenAjax({
            id: 'ServiceHostId'
        });
        ChosenAjaxObj.setCallback(function(searchString) {
            $.ajax({
                dataType: "json",
                url: '/hosts/loadHostsByString.json',
                data: {
                    'angular': !0,
                    'filter[Host.name]': searchString,
                    'selected[]': $('#ServiceHostId').val()
                },
                success: function(response) {
                    ChosenAjaxObj.addOptions(response.hosts, !0)
                }
            })
        });
        ChosenAjaxObj.render();
        $('input[type="checkbox"]#ServiceFlapDetectionEnabled').on('change.flapDetect', this.checkFlapDetection);
        this.checkFlapDetection();
        $('input[type="checkbox"]#ServiceFreshnessChecksEnabled').on('change.fresshnessChecks', function() {
            this.checkFreshnessSettings()
        }.bind(this));
        this.checkFreshnessSettings();
        var $serviceNotificationIntervalField = $('#ServiceNotificationinterval');
        var onSlideStop = function(ev) {
            if (ev.value == null) {
                ev.value = 0
            }
            $('#_' + $(this).attr('id')).val(ev.value);
            $(this).val(ev.value).trigger('change');
            var min = parseInt(ev.value / 60, 10);
            var sec = parseInt(ev.value % 60, 10);
            $($(this).attr('human')).html(min + " " + self.lang[1] + " " + self.lang[3] + " " + sec + " " + self.lang[2])
        };
        var $slider = $('input.slider');
        $slider.slider({
            tooltip: 'hide'
        });
        $slider.slider('on', 'slide', onSlideStop);
        $slider.slider('on', 'slideStop', onSlideStop);
        var onChangeSliderInput = function() {
            var $this = $(this);
            $('#' + $this.attr('slider-for')).slider('setValue', parseInt($this.val(), 10), !0).val($this.val()).attr('value', $this.val());
            $serviceNotificationIntervalField.trigger('change');
            var min = parseInt($this.val() / 60, 10);
            var sec = parseInt($this.val() % 60, 10);
            $($this.attr('human')).html(min + " " + self.lang[1] + " " + self.lang[3] + " " + sec + " " + self.lang[2])
        };
        $('.slider-input').on('change.slider', onChangeSliderInput);
        $('#ServiceCommandId').on('change.serviceCommand', function() {
            self.loadParametersByCommandId($(this).val(), $('#ServiceServicetemplateId').val(), $('#CheckCommandArgs'))
        });
        $('#ServiceEventhandlerCommandId').on('change.commandId', function() {
            self.loadNagParametersByCommandId($(this).val(), $('#ServiceServicetemplateId').val(), $('#EventhandlerCommandArgs'))
        });
        self.servicetemplateManager = {
            isRestoreFunctionalityInitialized: !1,
            isInitializedOnce: !1,
            init: function() {
                this.updateHosttemplateValues(this.initRestoreDefault)
            },
            _onChangeMacro: function() {
                var currentValueCount = 0,
                    allCurrentValues = {},
                    caseInsensitive = !0;
                $customVariablesContainer.children().each(function() {
                    var name = $(this).find('.macroName').val();
                    var value = $(this).find('.macroValue').val();
                    if (caseInsensitive) {
                        allCurrentValues[name.toUpperCase()] = value.toUpperCase()
                    } else {
                        allCurrentValues[name] = value
                    }
                    currentValueCount++
                });
                var templateValues = {};
                for (var key in self.servicetemplateManager.currentCustomVariables) {
                    var obj = self.servicetemplateManager.currentCustomVariables[key];
                    if (caseInsensitive) {
                        templateValues[obj.name.toUpperCase()] = obj.value.toUpperCase()
                    } else {
                        templateValues[obj.name] = obj.value
                    }
                }
                var isIdenticalWithTemplate = !0;
                if (Object.keys(templateValues).length != currentValueCount) {
                    isIdenticalWithTemplate = !1
                }
                if (isIdenticalWithTemplate) {
                    for (var name in templateValues) {
                        if (!allCurrentValues.hasOwnProperty(name)) {
                            isIdenticalWithTemplate = !1;
                            break
                        }
                        if (templateValues[name] !== allCurrentValues[name]) {
                            isIdenticalWithTemplate = !1;
                            break
                        }
                    }
                }
                self.servicetemplateManager._createOrUpdateMacroRestoreIcon(isIdenticalWithTemplate)
            },
            _restoreHostMacrosFromTemplate: function() {
                self.CustomVariables.loadMacroFromTemplate(self.servicetemplateManager.currentTemplate.id, self.servicetemplateManager._activateOrUpdateMacroRestore)
            },
            _createOrUpdateMacroRestoreIcon: function(isIdenticalWithTemplate) {
                var $macroContainer = $('.service-macro-settings'),
                    $icon = $macroContainer.find('.fa-chain-default, .fa-chain-non-default'),
                    defaultClasses = 'fa fa-chain margin-left-10 ',
                    greenIconClass = defaultClasses + 'txt-color-green fa-chain-default',
                    redIconClass = defaultClasses + 'txt-color-red fa-chain-non-default',
                    currentIconClass = (isIdenticalWithTemplate ? greenIconClass : redIconClass);
                if (!$icon.length) {
                    $icon = $('<i>', {
                        class: currentIconClass
                    });
                    $macroContainer.prepend($icon)
                }
                if (!isIdenticalWithTemplate) {
                    $icon.off('click');
                    $icon.on('click', self.servicetemplateManager._restoreHostMacrosFromTemplate)
                }
                $icon.attr('class', (isIdenticalWithTemplate ? greenIconClass : redIconClass))
            },
            _activateOrUpdateMacroRestore: function(response) {
                var $customVariablesContainer = this;
                var allCurrentValues = {};
                $('#customVariablesContainer').children().each(function(index) {
                    var fields = {
                        $name: $(this).find('.macroName'),
                        $value: $(this).find('.macroValue')
                    };
                    allCurrentValues[fields.$name.val()] = fields.$value.val();
                    for (var key in fields) {
                        if (!fields.hasOwnProperty(key)) {
                            continue
                        }
                        var $field = fields[key];
                        $field.off('change.restoreDefault').off('keyup').on('change.restoreDefault', self.servicetemplateManager._onChangeMacro).on('keyup', self.servicetemplateManager._onChangeMacro);
                        self.servicetemplateManager._onChangeMacro()
                    }
                });
                self.servicetemplateManager._onChangeMacro();
                $(document).off('click.macroRemove', '.deleteMacro');
                $(document).on('click.macroRemove', '.deleteMacro', self.servicetemplateManager._onChangeMacro)
            },
            deactivateRestoreFunctionality: function() {
                for (var key in self.fieldMap) {
                    var fieldId = 'Service' + self.fieldMap[key];
                    var $field = $('#' + fieldId);
                    var $fieldFormGroup = $field.parents('.form-group');
                    $fieldFormGroup.find('input, select').not('[type="hidden"]').not('[type="checkbox"]').off('change.restoreDefault');
                    $fieldFormGroup.find('.fa-chain, .fa-chain-broken').remove()
                }
                var $hostMacroSettings = $('.service-macro-settings');
                $hostMacroSettings.find('.fa-chain-default, .fa-chain-non-default').remove();
                $hostMacroSettings.off('click.MacroRemove', '.deleteMacro');
                self.servicetemplateManager.isRestoreFunctionalityInitialized = !1
            },
            onClickRestoreDefault: function() {
                var $field = $(this);
                var fieldType = self.servicetemplateManager.getFieldType($field);
                var inputId = $field.attr('id') || '';
                var keyName;
                if (inputId.match(/stars-rating/)) {
                    keyName = getObjectKeyByValue(self.fieldMap, 'stars-rating-5')
                } else {
                    keyName = getObjectKeyByValue(self.fieldMap, inputId.replace(/^(Service)/, ''))
                }
                var templateDefaultValue = self.servicetemplateManager.currentTemplate[keyName];
                if (typeof templateDefaultValue === 'undefined') {
                    templateDefaultValue = $field.prop('data-template-default')
                }
                if (in_array(keyName, ['contact', 'contactgroup', 'servicegroup'])) {
                    switch (keyName) {
                        case 'contact':
                            templateDefaultValue = self.servicetemplateManager.currentContact.map(function(elem) {
                                return elem.id
                            });
                            break;
                        case 'contactgroup':
                            templateDefaultValue = self.servicetemplateManager.currentContactGroup.map(function(elem) {
                                return elem.id
                            });
                            break;
                        case 'servicegroup':
                            templateDefaultValue = self.servicetemplateManager.currentServiceGroup.map(function(elem) {
                                return elem.id
                            });
                            break
                    }
                }
                if ($field.prop('disabled')) {
                    return
                }
                if (fieldType === 'checkbox') {
                    if (templateDefaultValue == '0') {
                        templateDefaultValue = !1
                    } else {
                        templateDefaultValue = !!templateDefaultValue
                    }
                    $field.prop('checked', templateDefaultValue).trigger('change')
                } else if (fieldType === 'select') {
                    $field.val(templateDefaultValue).trigger('chosen:updated').trigger('change')
                } else if (fieldType === 'radio') {
                    $field.parent().find('input').each(function() {
                        if ($(this).val() != templateDefaultValue) {
                            return
                        }
                        $(this).prop('checked', !0).trigger('change')
                    })
                } else if ($field.hasClass('slider')) {
                    var $otherInput = $field.parents('.form-group').find('input[type=number]');
                    $otherInput.val(templateDefaultValue).trigger('change');
                    $field.trigger('change')
                } else if ($field.hasClass('tagsinput')) {
                    var tags = templateDefaultValue.split(',');
                    $field.tagsinput('removeAll');
                    for (var key in tags) {
                        $field.tagsinput('add', tags[key])
                    }
                } else {
                    $field.val(templateDefaultValue).trigger('change')
                }
            },
            getFieldType: function($field) {
                var fieldType = $field.attr('type');
                if (!fieldType) {
                    fieldType = $field.prop('tagName').toLowerCase()
                }
                return fieldType
            },
            onChangeField: function(event) {
                var $field = $(this);
                var $label = null;
                var inputId = $field.attr('id') || '';
                var keyName;
                if (inputId.match(/stars-rating/)) {
                    keyName = getObjectKeyByValue(self.fieldMap, 'stars-rating-5')
                } else {
                    keyName = getObjectKeyByValue(self.fieldMap, inputId.replace(/^(Service)/, ''))
                }
                var templateDefaultValue = self.servicetemplateManager.currentTemplate[keyName];
                var templateDefaultTitle = '';
                if (typeof templateDefaultValue === 'undefined') {
                    templateDefaultValue = $field.prop('data-template-default')
                }
                if (in_array(keyName, ['contact', 'contactgroup', 'servicegroup'])) {
                    switch (keyName) {
                        case 'contact':
                            templateDefaultValue = self.servicetemplateManager.currentContact.map(function(elem) {
                                return elem.id
                            });
                            templateDefaultTitle = self.servicetemplateManager.currentContact.map(function(elem) {
                                return elem.name
                            });
                            break;
                        case 'contactgroup':
                            templateDefaultValue = self.servicetemplateManager.currentContactGroup.map(function(elem) {
                                return elem.id
                            });
                            templateDefaultTitle = self.servicetemplateManager.currentContactGroup.map(function(elem) {
                                return elem.Container.name
                            });
                            break;
                        case 'servicegroup':
                            templateDefaultValue = self.servicetemplateManager.currentServiceGroup.map(function(elem) {
                                return elem.id
                            });
                            templateDefaultTitle = self.servicetemplateManager.currentServiceGroup.map(function(elem) {
                                return elem.Container.name
                            });
                            break
                    }
                    templateDefaultTitle = templateDefaultTitle.join(', ')
                }
                var fieldType = self.servicetemplateManager.getFieldType($field);
                var nonDefaultClassName = 'fa fa-chain-broken fa-chain-non-default txt-color-red';
                var defaultClassName = 'fa fa-chain fa-chain-default txt-color-green';
                var defaultTitle = 'Default value';
                var restoreDefaultTitle;
                if (templateDefaultTitle != '') {
                    restoreDefaultTitle = 'Restore template default: "' + templateDefaultTitle + '"'
                } else {
                    restoreDefaultTitle = 'Restore template default: "' + templateDefaultValue + '"'
                }
                if (typeof templateDefaultValue === 'undefined' || templateDefaultValue === null) {
                    return
                }
                var fieldValue = null;
                switch (fieldType) {
                    case 'checkbox':
                        if (templateDefaultValue == '0') {
                            templateDefaultValue = !1
                        } else {
                            templateDefaultValue = !!templateDefaultValue
                        }
                        fieldValue = $field.is(':checked');
                        templateDefaultValue = templateDefaultValue;
                        break;
                    case 'radio':
                        fieldValue = $field.parents('.form-group').find('[name="' + $field.attr('name') + '"]:checked').val();
                        break;
                    case 'select':
                        fieldValue = $field.val();
                        if (in_array(keyName, ['contact', 'contactgroup', 'servicegroup'])) {
                            if (fieldValue === null) {
                                fieldValue = []
                            }
                        } else {
                            restoreDefaultTitle = 'Restore default: "' + $field.find('option[value="' + templateDefaultValue + '"]').text() + '"'
                        }
                        break;
                    default:
                        fieldValue = $field.val();
                        break
                }
                if (fieldValue === null) {
                    return
                }
                var wrappedOnClickRestore = function() {
                    self.servicetemplateManager.onClickRestoreDefault.call($field)
                };
                var $restoreDefaultIcon = $field.parents('.form-group').find('.fa-chain, .fa-chain-broken');
                var isEqual = (is_scalar(fieldValue) && is_scalar(templateDefaultValue) && fieldValue == templateDefaultValue) || (is_array(fieldValue) && is_array(templateDefaultValue) && is_array_equal(fieldValue, templateDefaultValue));
                if (isEqual) {
                    if (!$restoreDefaultIcon.length) {
                        $restoreDefaultIcon = $('<i>', {
                            'class': defaultClassName,
                            'title': defaultTitle
                        });
                        $field.parents('.form-group').append($restoreDefaultIcon)
                    } else {
                        $restoreDefaultIcon.attr({
                            'class': defaultClassName,
                            'title': defaultTitle
                        }).off('click')
                    }
                } else {
                    if (!$restoreDefaultIcon.length) {
                        $restoreDefaultIcon = $('<i>', {
                            'class': nonDefaultClassName,
                            'title': restoreDefaultTitle
                        });
                        $restoreDefaultIcon.on('click', wrappedOnClickRestore);
                        $field.parents('.form-group').append($restoreDefaultIcon)
                    } else {
                        $restoreDefaultIcon.attr({
                            'class': nonDefaultClassName,
                            'title': restoreDefaultTitle
                        }).off('click').on('click', wrappedOnClickRestore)
                    }
                }
            },
            initRestoreDefault: function() {
                self.servicetemplateManager.deactivateRestoreFunctionality();
                for (var key in self.fieldMap) {
                    if (!self.fieldMap.hasOwnProperty(key)) {
                        return
                    }
                    var $field = $('#Service' + self.fieldMap[key]);
                    var fieldType = $field.attr('type');
                    if (!fieldType) {
                        fieldType = $field.prop('tagName').toLowerCase()
                    }
                    switch (fieldType) {
                        case 'text':
                        case 'checkbox':
                            self.servicetemplateManager.onChangeField.call($field);
                            $field.on('change.restoreDefault', self.servicetemplateManager.onChangeField);
                            $field.on('keyup', self.servicetemplateManager.onChangeField);
                            break;
                        case 'radio':
                            var $radioFields = $field.parents('.form-group').find('[name="' + $field.attr('name') + '"]');
                            $radioFields.each(function() {
                                self.servicetemplateManager.onChangeField.call($(this));
                                $(this).on('change.restoreDefault', function() {
                                    self.servicetemplateManager.onChangeField.call($(this))
                                })
                            });
                            break;
                        case 'select':
                            self.servicetemplateManager.onChangeField.call($field);
                            $field.on('change.restoreDefault', self.servicetemplateManager.onChangeField);
                            break;
                        case 'number':
                            self.servicetemplateManager.onChangeField.call($field);
                            $field.on('change.restoreDefault', self.servicetemplateManager.onChangeField);
                            break;
                        case 'default':
                            break
                    }
                }
                self.servicetemplateManager.isRestoreFunctionalityInitialized = !0;
                self.servicetemplateManager.isInitializedOnce = !0
            },
            updateHosttemplateValues: function(onComplete) {
                self.servicetemplateManager.currentTemplate = {};
                var $selectBoxHosttemplate = $('#ServiceServicetemplateId');
                var ajaxCompleteCallback = function(response) {
                    var responseObject = response.responseJSON;
                    if (responseObject.code === 'not_authenticated' || responseObject.servicetemplate.length == 0) {
                        return
                    }
                    var hosttemplateId = $selectBoxHosttemplate.val(),
                        servicetemplate = responseObject.servicetemplate;
                    self.servicetemplateManager.currentTemplate = servicetemplate.Servicetemplate;
                    self.servicetemplateManager.currentContact = servicetemplate.Contact;
                    self.servicetemplateManager.currentContactGroup = servicetemplate.Contactgroup;
                    self.servicetemplateManager.currentServiceGroup = servicetemplate.Servicegroup;
                    self.servicetemplateManager.currentCustomVariables = servicetemplate.Customvariable;
                    window.currentTemplate = servicetemplate.Servicetemplate;
                    window.currentContact = servicetemplate.Contact;
                    window.currentContactGroup = servicetemplate.Contactgroup;
                    window.currentServiceGroup = servicetemplate.Servicegroup;
                    window.currentCustomVariable = servicetemplate.Customvariable;
                    if (self.servicetemplateManager.currentTemplate.id != hosttemplateId) {
                        self.Ajaxloader.hide();
                        return
                    }
                    if (self.servicetemplateManager.isInitializedOnce) {
                        for (var key in self.fieldMap) {
                            if (in_array(key, ['check_interval', 'retry_interval', 'notification_interval'])) {
                                self.updateSlider({
                                    value: servicetemplate.Servicetemplate[key],
                                    selector: self.fieldMap[key]
                                })
                            } else if (key == 'priority') {
                                $('#Servicestars-rating-' + servicetemplate.Servicetemplate[key]).prop('checked', !0).parents('.form-group').find('input[type=radio]')
                            } else if (key == 'tags') {
                                self.updateTags({
                                    tags: servicetemplate.Servicetemplate[key]
                                })
                            } else if (in_array(key, ['notify_on_recovery', 'notify_on_warning', 'notify_on_unknown', 'notify_on_critical', 'notify_on_downtime', 'notify_on_flapping', 'notify_on_downtime', 'flap_detection_enabled', 'flap_detection_on_ok', 'flap_detection_on_warning', 'flap_detection_on_unknown', 'flap_detection_on_critical', 'is_volatile', 'freshness_checks_enabled', 'process_performance_data', 'active_checks_enabled'])) {
                                self.updateCheckbox({
                                    value: servicetemplate.Servicetemplate[key],
                                    selector: self.fieldMap[key]
                                })
                            } else if (in_array(key, ['notify_period_id', 'command_id', 'check_period_id', 'eventhandler_command_id'])) {
                                self.updateSelectbox({
                                    value: servicetemplate.Servicetemplate[key],
                                    selector: self.fieldMap[key]
                                })
                            } else {
                                $('#Service' + self.fieldMap[key]).val(servicetemplate.Servicetemplate[key])
                            }
                        }
                        var selectedContacts = [];
                        $(servicetemplate.Contact).each(function(intIndex, jsonContact) {
                            selectedContacts.push(jsonContact.id)
                        });
                        self.updateSelectbox({
                            value: selectedContacts,
                            selector: '#ServiceContact',
                            prefix: 'false'
                        });
                        var selectedContactgroups = [];
                        $(servicetemplate.Contactgroup).each(function(intIndex, jsonContactgroup) {
                            selectedContactgroups.push(jsonContactgroup.id)
                        });
                        self.updateSelectbox({
                            value: selectedContactgroups,
                            selector: '#ServiceContactgroup',
                            prefix: 'false'
                        });
                        var selectedServicegroups = [];
                        $(servicetemplate.Servicegroup).each(function(intIndex, jsonServicegroup) {
                            selectedServicegroups.push(jsonServicegroup.id)
                        });
                        self.updateSelectbox({
                            value: selectedServicegroups,
                            selector: '#ServiceServicegroup',
                            prefix: 'false'
                        })
                    }
                    self.loadParametersByCommandId(servicetemplate.Servicetemplate.command_id, servicetemplate.Servicetemplate.id, $('#CheckCommandArgs'));
                    self.loadNagParametersByCommandId(servicetemplate.Servicetemplate.eventhandler_command_id, servicetemplate.Servicetemplate.id, $('#EventhandlerCommandArgs'));
                    self.CustomVariables.loadMacroFromTemplate(self.servicetemplateManager.currentTemplate.id, self.servicetemplateManager._activateOrUpdateMacroRestore);
                    self.Ajaxloader.hide();
                    onComplete()
                };
                var onChangeHosttemplate = function() {
                    self.servicetemplateManager.isRestoreFunctionalityInitialized = !0;
                    var templateId = parseInt($(this).val(), 10);
                    if (templateId <= 0) {
                        self.servicetemplateManager.currentTemplate = {};
                        self.servicetemplateManager.deactivateRestoreFunctionality();
                        return !1
                    }
                    $('#content').find('.fa-link').remove();
                    self.Ajaxloader.show();
                    $.ajax({
                        url: "/Services/loadTemplateData/" + encodeURIComponent(templateId) + ".json",
                        type: "POST",
                        cache: !1,
                        error: function() {},
                        success: function() {},
                        complete: ajaxCompleteCallback
                    })
                };
                if (parseInt($selectBoxHosttemplate.val(), 10) > 0) {
                    onChangeHosttemplate.call($selectBoxHosttemplate)
                } else {
                    self.servicetemplateManager.isInitializedOnce = !0
                }
                $selectBoxHosttemplate.on('change.hostTemplate', onChangeHosttemplate);
                var $serviceCommandId = $('#ServiceCommandId'),
                    $serviceTemplateId = $('#ServiceServicetemplateId');
                if ($serviceCommandId.val() !== null && $serviceTemplateId.val() != 0) {
                    self.loadParametersByCommandId($serviceCommandId.val(), $serviceTemplateId.val(), $('#CheckCommandArgs'))
                }
            }
        };
        self.servicetemplateManager.init()
    },
    loadInitialData: function(selector, selectedHostId, callback) {
        var self = this;
        var requestParams = {
            'angular': !0,
            'selected[]': selectedHostId
        };
        if (selectedHostId !== null) {
            requestParams.selected = selectedHostId
        }
        if (this.selectedHostId !== 0) {
            selectedHostId = this.selectedHostId;
            requestParams.selected = this.selectedHostId
        }
        $.ajax({
            dataType: "json",
            url: '/hosts/loadHostsByString.json',
            data: requestParams,
            success: function(response) {
                var $selector = $(selector);
                var list = self.buildList(response.hosts, selectedHostId, !0);
                $selector.append(list);
                $selector.trigger('chosen:updated');
                $selector.change();
                if (callback != undefined) {
                    callback()
                }
            }
        })
    },
    buildList: function(data, selected, includePlaceholderOption) {
        var html = '';
        if (includePlaceholderOption) {
            html += '<option><!-- Empty option for placeholder --><option>'
        }
        for (var i in data) {
            if (data[i].key == selected && selected !== null) {
                html += '<option value="' + data[i].key + '" selected="selected">' + htmlspecialchars(data[i].value) + '</option>'
            } else {
                html += '<option value="' + data[i].key + '">' + htmlspecialchars(data[i].value) + '</option>'
            }
        }
        return html
    },
    checkFlapDetection: function() {
        var disable = null;
        if (!$('input[type="checkbox"]#ServiceFlapDetectionEnabled').prop('checked')) {
            disable = !0
        }
        $('.flapdetection_control').prop('disabled', disable)
    },
    checkFreshnessSettings: function() {
        var readonly = null;
        if (!$('input[type="checkbox"]#ServiceFreshnessChecksEnabled').prop('checked')) {
            readonly = !0;
            $('#ServiceFreshnessThreshold').val('')
        }
        $('#ServiceFreshnessThreshold').prop('readonly', readonly)
    },
    updateTags: function(_options) {
        var options = _options || {};
        options.tags = _options.tags || "";
        options.remove = _options.remove || !0;
        if (options.remove === !0) {
            this.$tagsinput.tagsinput('removeAll')
        }
        this.$tagsinput.tagsinput('add', options.tags)
    },
    updateSlider: function(_options) {
        var options = _options || {};
        options.value = parseInt(_options.value, 10) || 0;
        options.selector = _options.selector || null;
        $('#Service' + options.selector).slider('setValue', options.value);
        $('#_Service' + options.selector).val(options.value);
        $('#Service' + options.selector).val(options.value);
        $('_#Service' + options.selector).trigger('keyup');
        var $helptext = $('#Service' + options.selector + '_human');
        var min = parseInt(options.value / 60, 10);
        var sec = parseInt(options.value % 60, 10);
        $helptext.html(min + " " + this.lang[1] + " " + this.lang[3] + " " + sec + " " + this.lang[2])
    },
    updateCheckbox: function(_options) {
        var options = _options || {};
        options.value = _options.value || null;
        options.selector = _options.selector || '';
        if (options.value === null || options.value == 0 || options.value == !1) {
            $('input[type="checkbox"]#Service' + options.selector).prop('checked', !1);
            this.checkFlapDetection();
            return !1
        }
        $('input[type="checkbox"]#Service' + options.selector).prop('checked', !0).trigger('change');
        this.checkFlapDetection();
        return !0
    },
    updateSelectbox: function(_options) {
        var options = _options || {};
        options.value = _options.value || 0;
        options.selector = _options.selector || '';
        options.prefix = _options.prefix || "#Service";
        if (options.prefix == 'false') {
            options.prefix = ''
        }
        $(options.prefix + options.selector).val(options.value);
        $(options.prefix + options.selector).trigger("chosen:updated").change()
    },
    loadParametersByCommandId: function(command_id, servicetemplate_id, $target) {
        var self = this;
        if (!command_id || !servicetemplate_id || !$target || !$target.length) {
            throw new Error('Invalid argument given')
        }
        this.Ajaxloader.show();
        $.ajax({
            url: '/Services/loadParametersByCommandId/' + encodeURIComponent(command_id) + '/' + encodeURIComponent(servicetemplate_id),
            type: 'POST',
            cache: !1,
            error: function() {},
            success: function() {},
            complete: function(response) {
                $target.html(response.responseText);
                self.Ajaxloader.hide()
            }
        })
    },
    loadNagParametersByCommandId: function(command_id, servicetemplate_id, $target) {
        var self = this;
        if (!command_id || !servicetemplate_id || !$target || !$target.length) {
            throw new Error('Invalid argument given')
        }
        this.Ajaxloader.show();
        $.ajax({
            url: '/Services/loadNagParametersByCommandId/' + encodeURIComponent(command_id) + '/' + encodeURIComponent(servicetemplate_id),
            type: 'POST',
            cache: !1,
            error: function() {},
            success: function() {},
            complete: function(response) {
                $target.html(response.responseText);
                self.Ajaxloader.hide()
            }
        })
    },
    loadParameters: function(command_id, $target) {
        this.Ajaxloader.show();
        $.ajax({
            url: "/Services/loadArgumentsAdd/" + encodeURIComponent(command_id),
            type: "POST",
            cache: !1,
            error: function() {},
            success: function() {},
            complete: function(response) {
                $target.html(response.responseText);
                this.Ajaxloader.hide()
            }.bind(this)
        })
    },
    loadParametersFromTemplate: function(servicetemplate_id) {
        $.ajax({
            url: "/Services/loadServicetemplatesArguments/" + encodeURIComponent(servicetemplate_id),
            type: "POST",
            cache: !1,
            error: function() {},
            success: function() {},
            complete: function(response) {
                $('#CheckCommandArgs').html(response.responseText);
                this.Ajaxloader.hide()
            }.bind(this)
        })
    }
});
App.Controllers.ServicesGrapherTemplateController = Frontend.AppController.extend({
    components: ['Ajaxloader'],
    _initialize: function() {
        this.Ajaxloader.setup();
        var self = this;
        $('.resetZoom').click(function() {
            var $this = $(this);
            self.resetZoom($this.attr('start'), $this.attr('end'), $this.attr('ds'), $this.attr('service_id'), $this);
            $this.parent().hide()
        });
        $('.zoomSelection').load(function() {
            var $img = $(this);
            $img.parent().parent().find('.grapherLoader').hide()
        });
        document.oncontextmenu = function() {
            return !1
        };
        $('.zoomSelection').mousedown(function(e) {
            if (e.button == 2) {
                var $img = $(this);
                var start = parseInt($img.attr('start'));
                var end = parseInt($img.attr('end'));
                var newGraphStart = start - (end - start) * 0.5;
                var newGraphEnd = end + (end - start) * 0.5;
                if (newGraphStart < 0) {
                    newGraphStart = 0
                }
                if (newGraphEnd < 0) {
                    newGraphEnd = 0
                }
                $img.parent().parent().parent().parent().parent().find('.graphTime').html(date('d.m.Y H:i', newGraphStart) + ' - ' + date('d.m.Y H:i', newGraphEnd));
                $img.parent().parent().parent().parent().parent().find('.widget-toolbar').show();
                $img.attr('start', newGraphStart);
                $img.attr('end', newGraphEnd);
                $img.parent().parent().find('.grapherLoader').show();
                $img.attr('src', '/services/grapherZoomTemplate/' + encodeURIComponent($img.attr('service_id')) + '/' + encodeURIComponent($img.attr('ds')) + '/' + parseInt(newGraphStart) + '/' + parseInt(newGraphEnd) + '/' + $img.attr('commandUuid'));
                return !1
            }
            return !0
        });
        $('.zoomSelection').load(function() {
            $('.zoomSelection').each(function(key, object) {
                var $object = $(object);
                $object.imgAreaSelect({
                    handles: !0,
                    minHeight: $object.innerHeight(),
                    movable: !1,
                    resizable: !1,
                    autoHide: !0,
                    onSelectEnd: self.startZoom
                })
            }.bind(self))
        }.bind(self))
    },
    startZoom: function(img, selection) {
        var $img = $(img);
        var minX = Math.min(selection.x1, selection.x2);
        var maxX = Math.max(selection.x1, selection.x2);
        if (minX < 0) {
            minX = 0
        }
        if (maxX > ($img.innerWidth() - 67 - 27)) {
            maxX = ($img.innerWidth() - 67 - 27)
        }
        var start = parseInt($img.attr('start'));
        var end = parseInt($img.attr('end'));
        var onePixel = (end - start) / ($img.innerWidth() - 67 - 27);
        var newGraphStart = Math.round(start + ((minX - 67) * onePixel));
        var newGraphEnd = Math.round(end - (($img.innerWidth() - 67 - 27) - (maxX - 67)) * onePixel);
        $img.parent().parent().parent().parent().parent().find('.graphTime').html(date('d.m.Y H:i', newGraphStart) + ' - ' + date('d.m.Y H:i', newGraphEnd));
        $img.parent().parent().parent().parent().parent().find('.widget-toolbar').show();
        $img.attr('start', newGraphStart);
        $img.attr('end', newGraphEnd);
        $img.parent().parent().find('.grapherLoader').show();
        $img.attr('src', '/services/grapherZoomTemplate/' + encodeURIComponent($img.attr('service_id')) + '/' + encodeURIComponent($img.attr('ds')) + '/' + newGraphStart + '/' + newGraphEnd + '/' + $img.attr('commandUuid'))
    },
    resetZoom: function(start, end, ds, service_id, objectThis) {
        objectThis.parent().parent().find('.graphTime').html(date('d.m.Y H:i', start) + ' - ' + date('d.m.Y H:i', end));
        objectThis.parent().parent().parent().find('.grapherLoader').show();
        var $img = objectThis.parent().parent().parent().find('.zoomSelection');
        $img.attr('start', start);
        $img.attr('end', end);
        $img.attr('src', '/services/grapherZoomTemplate/' + encodeURIComponent(service_id) + '/' + encodeURIComponent(ds) + '/' + start + '/' + end + '/' + objectThis.attr('commandUuid'))
    }
});
App.Controllers.ServicesCopyController = Frontend.AppController.extend({
    _initialize: function() {
        this.loadInitialData('#ServiceHostId');
        var ChosenAjaxObj = new ChosenAjax({
            id: 'ServiceHostId'
        });
        ChosenAjaxObj.setCallback(function(searchString) {
            $.ajax({
                dataType: "json",
                url: '/hosts/loadHostsByString.json',
                data: {
                    'angular': !0,
                    'filter[Host.name]': searchString
                },
                success: function(response) {
                    ChosenAjaxObj.addOptions(response.hosts)
                }
            })
        });
        ChosenAjaxObj.render()
    },
    loadInitialData: function(selector, selectedHostIds, callback) {
        var self = this;
        if (selectedHostIds == null || selectedHostIds.length < 1) {
            selectedHostIds = []
        } else {
            if (!Array.isArray(selectedHostIds)) {
                selectedHostIds = [selectedHostIds]
            }
        }
        $.ajax({
            dataType: "json",
            url: '/hosts/loadHostsByString.json',
            data: {
                'angular': !0,
                'selected[]': selectedHostIds
            },
            success: function(response) {
                var $selector = $(selector);
                var list = self.buildList(response.hosts);
                $selector.append(list);
                $selector.val(selectedHostIds);
                $selector.trigger('chosen:updated');
                if (callback != undefined) {
                    callback()
                }
            }
        })
    },
    buildList: function(data) {
        var html = '';
        for (var i in data) {
            html += '<option value="' + data[i].key + '">' + htmlspecialchars(data[i].value) + '</option>'
        }
        return html
    },
});
App.Controllers.ServicesGrapherController = Frontend.AppController.extend({
    components: ['Ajaxloader'],
    _initialize: function() {
        this.Ajaxloader.setup();
        var self = this;
        $('#hide-show-thresholds').change(function() {
            localStorage.setItem('service_show_tresholds_' + $(this).attr('data-service'), $(this).is(':checked') ? '1' : '0');
            $('.resetZoom').click()
        });
        $('.resetZoom').click(function() {
            var $this = $(this);
            var showThresholds = $('#hide-show-thresholds').is(':checked') ? '1' : '0';
            self.resetZoom($this.attr('start'), $this.attr('end'), $this.attr('ds'), $this.attr('service_id'), $this, showThresholds);
            $this.parent().hide()
        });
        $('.zoomSelection').load(function() {
            var $img = $(this);
            $img.parent().parent().find('.grapherLoader').hide()
        });
        document.oncontextmenu = function() {
            return !1
        };
        $('.zoomSelection').mousedown(function(e) {
            if (e.button == 2) {
                var $img = $(this);
                var start = parseInt($img.attr('start'));
                var end = parseInt($img.attr('end'));
                var newGraphStart = start - (end - start) * 0.5;
                var newGraphEnd = end + (end - start) * 0.5;
                if (newGraphStart < 0) {
                    newGraphStart = 0
                }
                if (newGraphEnd < 0) {
                    newGraphEnd = 0
                }
                $img.parent().parent().parent().parent().parent().find('.graphTime').html(date('d.m.Y H:i', newGraphStart) + ' - ' + date('d.m.Y H:i', newGraphEnd));
                $img.parent().parent().parent().parent().parent().find('.widget-toolbar').show();
                $img.attr('start', newGraphStart);
                $img.attr('end', newGraphEnd);
                $img.parent().parent().find('.grapherLoader').show();
                var showThresholds = $('#hide-show-thresholds').is(':checked') ? '1' : '0';
                $img.attr('src', '/services/grapherZoom/' + encodeURIComponent($img.attr('service_id')) + '/' + encodeURIComponent($img.attr('ds')) + '/' + parseInt(newGraphStart) + '/' + parseInt(newGraphEnd) + '/' + showThresholds);
                return !1
            }
            return !0
        });
        $('.zoomSelection').load(function() {
            $('.zoomSelection').each(function(key, object) {
                var $object = $(object);
                $object.imgAreaSelect({
                    handles: !0,
                    minHeight: $object.innerHeight(),
                    movable: !1,
                    resizable: !1,
                    autoHide: !0,
                    onSelectEnd: self.startZoom
                })
            }.bind(self))
        }.bind(self))
    },
    startZoom: function(img, selection) {
        var $img = $(img);
        var minX = Math.min(selection.x1, selection.x2);
        var maxX = Math.max(selection.x1, selection.x2);
        if (minX < 0) {
            minX = 0
        }
        if (maxX > ($img.innerWidth() - 67 - 27)) {
            maxX = ($img.innerWidth() - 67 - 27)
        }
        var start = parseInt($img.attr('start'));
        var end = parseInt($img.attr('end'));
        var onePixel = ((end - start) / ($img.innerWidth() - 67 - 27));
        var newGraphStart = Math.round(start + ((minX - 67) * onePixel));
        if (maxX >= $img.innerWidth() - 67 - 27) {
            var newGraphEnd = Math.round(end)
        } else {
            var newGraphEnd = Math.round(end - (($img.innerWidth() - 67 - 27) - maxX) * onePixel)
        }
        $img.parents('.jarviswidget').find('.graphTime').html(date('d.m.Y H:i', newGraphStart) + ' - ' + date('d.m.Y H:i', newGraphEnd));
        $img.parents('.jarviswidget').find('.widget-toolbar').show();
        $img.attr('start', newGraphStart);
        $img.attr('end', newGraphEnd);
        $img.parent().parent().find('.grapherLoader').show();
        var showThresholds = $('#hide-show-thresholds').is(':checked') ? '1' : '0';
        $img.attr('src', '/services/grapherZoom/' + encodeURIComponent($img.attr('service_id')) + '/' + encodeURIComponent($img.attr('ds')) + '/' + newGraphStart + '/' + newGraphEnd + '/' + showThresholds)
    },
    resetZoom: function(start, end, ds, service_id, objectThis, showThresholds) {
        objectThis.parent().parent().find('.graphTime').html(date('d.m.Y H:i', start) + ' - ' + date('d.m.Y H:i', end));
        objectThis.parent().parent().parent().find('.grapherLoader').show();
        var $img = objectThis.parent().parent().parent().find('.zoomSelection');
        $img.attr('start', start);
        $img.attr('end', end);
        $img.attr('src', '/services/grapherZoom/' + encodeURIComponent(service_id) + '/' + encodeURIComponent(ds) + '/' + start + '/' + end + '/' + showThresholds)
    }
});
App.Controllers.ServicesEditController = Frontend.AppController.extend({
    $contacts: null,
    $contactgroups: null,
    $servicegroups: null,
    $tagsinput: null,
    lang: null,
    components: ['Highlight', 'Ajaxloader', 'CustomVariables'],
    _initialize: function() {
        var self = this;
        this.Ajaxloader.setup();
        this.CustomVariables.setup({
            controller: 'Services',
            ajaxUrl: 'addCustomMacro',
            macrotype: 'SERVICE',
            onClick: function() {
                self.servicetemplateManager._onChangeMacro();
                self.servicetemplateManager._activateOrUpdateMacroRestore()
            }
        });
        $('#inheritContacts').click(function() {
            this.inherit()
        }.bind(this));
        var $inheritContacts = $('#inheritContacts');
        if ($inheritContacts.prop('checked') == !0) {
            $('#serviceContactSelects').block({
                message: null,
                overlayCSS: {
                    opacity: 0.5,
                    cursor: 'not-allowed',
                    'background-color': 'rgb(255, 255, 255)'
                }
            })
        }
        $('#yesDeleteService').click(function() {
            var serviceId = $(this).data('serviceId');
            self.deleteService(serviceId)
        });
        $("[data-toggle='tab']").click(function() {
            $('.chosen-container').css('width', '100%')
        });
        this.$contacts = $('#ServiceContact');
        this.$contactgroups = $('#ServiceContactgroup');
        this.$servicegroups = $('#ServiceServicegroup');
        this.lang = [];
        this.lang[1] = this.getVar('lang_minutes');
        this.lang[2] = this.getVar('lang_seconds');
        this.lang[3] = this.getVar('lang_and');
        this.fieldMap = {};
        this.fieldMap.description = 'Description';
        this.fieldMap.notes = 'Notes';
        this.fieldMap.max_check_attempts = 'MaxCheckAttempts';
        this.fieldMap.name = 'Name';
        this.fieldMap.command_id = 'CommandId';
        this.fieldMap.notify_period_id = 'NotifyPeriodId';
        this.fieldMap.check_period_id = 'CheckPeriodId';
        this.fieldMap.notify_on_recovery = 'NotifyOnRecovery';
        this.fieldMap.notify_on_warning = 'NotifyOnWarning';
        this.fieldMap.notify_on_unknown = 'NotifyOnUnknown';
        this.fieldMap.notify_on_critical = 'NotifyOnCritical';
        this.fieldMap.notify_on_flapping = 'NotifyOnFlapping';
        this.fieldMap.notify_on_downtime = 'NotifyOnDowntime';
        this.fieldMap.flap_detection_enabled = 'FlapDetectionEnabled';
        this.fieldMap.flap_detection_on_ok = 'FlapDetectionOnOk';
        this.fieldMap.flap_detection_on_warning = 'FlapDetectionOnWarning';
        this.fieldMap.flap_detection_on_unknown = 'FlapDetectionOnUnknown';
        this.fieldMap.flap_detection_on_critical = 'FlapDetectionOnCritical';
        this.fieldMap.is_volatile = 'IsVolatile';
        this.fieldMap.freshness_checks_enabled = 'FreshnessChecksEnabled';
        this.fieldMap.freshness_threshold = 'FreshnessThreshold';
        this.fieldMap.command_id = 'CommandId';
        this.fieldMap.eventhandler_command_id = 'EventhandlerCommandId';
        this.fieldMap.process_performance_data = 'ProcessPerformanceData';
        this.fieldMap.active_checks_enabled = 'ActiveChecksEnabled';
        this.fieldMap.check_interval = 'Checkinterval';
        this.fieldMap.retry_interval = 'Retryinterval';
        this.fieldMap.notification_interval = 'Notificationinterval';
        this.fieldMap.tags = 'Tags';
        this.fieldMap.priority = 'stars-rating-5';
        this.fieldMap.contact = 'Contact';
        this.fieldMap.contactgroup = 'Contactgroup';
        this.fieldMap.servicegroup = 'Servicegroup';
        this.$tagsinput = $('.tagsinput');
        this.$tagsinput.tagsinput();
        $('input[type="checkbox"]#ServiceFlapDetectionEnabled').on('change.flapDetect', this.checkFlapDetection);
        this.checkFlapDetection();
        $('input[type="checkbox"]#ServiceFreshnessChecksEnabled').on('change.fresshnessChecks', function() {
            this.checkFreshnessSettings()
        }.bind(this));
        this.checkFreshnessSettings();
        var $serviceNotificationIntervalField = $('#ServiceNotificationinterval');
        var onSlideStop = function(ev) {
            if (ev.value == null) {
                ev.value = 0
            }
            $('#_' + $(this).attr('id')).val(ev.value);
            $(this).val(ev.value).trigger('change');
            var min = parseInt(ev.value / 60, 10);
            var sec = parseInt(ev.value % 60, 10);
            $($(this).attr('human')).html(min + " " + self.lang[1] + " " + self.lang[3] + " " + sec + " " + self.lang[2])
        };
        var $slider = $('input.slider');
        $slider.slider({
            tooltip: 'hide'
        });
        $slider.slider('on', 'slide', onSlideStop);
        $slider.slider('on', 'slideStop', onSlideStop);
        var onChangeSliderInput = function() {
            var $this = $(this);
            $('#' + $this.attr('slider-for')).slider('setValue', parseInt($this.val(), 10), !0).val($this.val()).attr('value', $this.val());
            $serviceNotificationIntervalField.trigger('change');
            var min = parseInt($this.val() / 60, 10);
            var sec = parseInt($this.val() % 60, 10);
            $($this.attr('human')).html(min + " " + self.lang[1] + " " + self.lang[3] + " " + sec + " " + self.lang[2])
        };
        $('.slider-input').on('change.slider', onChangeSliderInput);
        $('#ServiceCommandId').on('change.serviceCommand', function() {
            self.loadParametersByCommandId($(this).val(), $('#ServiceServicetemplateId').val(), $('#CheckCommandArgs'))
        });
        var $event_handler_command_args = $('#EventhandlerCommandArgs');
        $('#ServiceEventhandlerCommandId').on('change.commandId', function() {
            var id = $(this).val();
            if (id && id != '0') {
                self.loadNagParametersByCommandId(id, $('#ServiceServicetemplateId').val(), $event_handler_command_args)
            } else {
                $event_handler_command_args.html('')
            }
        });
        self.servicetemplateManager = {
            isRestoreFunctionalityInitialized: !1,
            isInitializedOnce: !1,
            init: function() {
                this.updateServicetemplateValues(this.initRestoreDefault)
            },
            _onChangeMacro: function() {
                var currentValueCount = 0,
                    allCurrentValues = {},
                    caseInsensitive = !0;
                var $customVariablesContainer = $('#customVariablesContainer');
                $customVariablesContainer.children().each(function() {
                    var name = $(this).find('.macroName').val();
                    var value = $(this).find('.macroValue').val();
                    if (caseInsensitive) {
                        allCurrentValues[name.toUpperCase()] = value.toUpperCase()
                    } else {
                        allCurrentValues[name] = value
                    }
                    currentValueCount++
                });
                var templateValues = {};
                for (var key in self.servicetemplateManager.currentCustomVariables) {
                    var obj = self.servicetemplateManager.currentCustomVariables[key];
                    if (caseInsensitive) {
                        templateValues[obj.name.toUpperCase()] = obj.value.toUpperCase()
                    } else {
                        templateValues[obj.name] = obj.value
                    }
                }
                var isIdenticalWithTemplate = !0;
                if (Object.keys(templateValues).length != currentValueCount) {
                    isIdenticalWithTemplate = !1
                }
                if (isIdenticalWithTemplate) {
                    for (var name in templateValues) {
                        if (!allCurrentValues.hasOwnProperty(name)) {
                            isIdenticalWithTemplate = !1;
                            break
                        }
                        if (templateValues[name] !== allCurrentValues[name]) {
                            isIdenticalWithTemplate = !1;
                            break
                        }
                    }
                }
                self.servicetemplateManager._createOrUpdateMacroRestoreIcon(isIdenticalWithTemplate)
            },
            _restoreServiceMacrosFromTemplate: function() {
                self.CustomVariables.loadMacroFromTemplate(self.servicetemplateManager.currentTemplate.id, self.servicetemplateManager._activateOrUpdateMacroRestore)
            },
            _createOrUpdateMacroRestoreIcon: function(isIdenticalWithTemplate) {
                var $macroContainer = $('.service-macro-settings'),
                    $icon = $macroContainer.find('.fa-chain-default, .fa-chain-non-default'),
                    defaultClasses = 'fa fa-chain margin-left-10 ',
                    greenIconClass = defaultClasses + 'txt-color-green fa-chain-default',
                    redIconClass = defaultClasses + 'txt-color-red fa-chain-non-default',
                    currentIconClass = (isIdenticalWithTemplate ? greenIconClass : redIconClass);
                if (!$icon.length) {
                    $icon = $('<i>', {
                        class: currentIconClass
                    });
                    $macroContainer.prepend($icon)
                }
                if (!isIdenticalWithTemplate) {
                    $icon.off('click');
                    $icon.on('click', self.servicetemplateManager._restoreServiceMacrosFromTemplate)
                }
                $icon.attr('class', (isIdenticalWithTemplate ? greenIconClass : redIconClass))
            },
            _activateOrUpdateMacroRestore: function(response) {
                var $customVariablesContainer = this;
                var allCurrentValues = {};
                $('#customVariablesContainer').children().each(function(index) {
                    var fields = {
                        $name: $(this).find('.macroName'),
                        $value: $(this).find('.macroValue')
                    };
                    allCurrentValues[fields.$name.val()] = fields.$value.val();
                    for (var key in fields) {
                        if (!fields.hasOwnProperty(key)) {
                            continue
                        }
                        var $field = fields[key];
                        $field.off('change.restoreDefault').off('keyup').on('change.restoreDefault', self.servicetemplateManager._onChangeMacro).on('keyup', self.servicetemplateManager._onChangeMacro);
                        self.servicetemplateManager._onChangeMacro()
                    }
                });
                self.servicetemplateManager._onChangeMacro();
                $(document).off('click.macroRemove', '.deleteMacro');
                $(document).on('click.macroRemove', '.deleteMacro', self.servicetemplateManager._onChangeMacro)
            },
            deactivateRestoreFunctionality: function() {
                for (var key in self.fieldMap) {
                    var fieldId = 'Service' + self.fieldMap[key];
                    var $field = $('#' + fieldId);
                    var $fieldFormGroup = $field.parents('.form-group');
                    $fieldFormGroup.find('input, select').not('[type="hidden"]').not('[type="checkbox"]').off('change.restoreDefault');
                    $fieldFormGroup.find('.fa-chain, .fa-chain-broken').remove()
                }
                var $serviceMacroSettings = $('.service-macro-settings');
                $serviceMacroSettings.find('.fa-chain-default, .fa-chain-non-default').remove();
                $serviceMacroSettings.off('click.MacroRemove', '.deleteMacro');
                self.servicetemplateManager.isRestoreFunctionalityInitialized = !1
            },
            onClickRestoreDefault: function() {
                var $field = $(this);
                var fieldType = self.servicetemplateManager.getFieldType($field);
                var inputId = $field.attr('id') || '';
                var keyName;
                if (inputId.match(/stars-rating/)) {
                    keyName = getObjectKeyByValue(self.fieldMap, 'stars-rating-5')
                } else {
                    keyName = getObjectKeyByValue(self.fieldMap, inputId.replace(/^(Service)/, ''))
                }
                var templateDefaultValue = self.servicetemplateManager.currentTemplate[keyName];
                if (typeof templateDefaultValue === 'undefined') {
                    templateDefaultValue = $field.prop('data-template-default')
                }
                if (in_array(keyName, ['contact', 'contactgroup', 'servicegroup'])) {
                    switch (keyName) {
                        case 'contact':
                            templateDefaultValue = self.servicetemplateManager.currentContact.map(function(elem) {
                                return elem.id
                            });
                            break;
                        case 'contactgroup':
                            templateDefaultValue = self.servicetemplateManager.currentContactGroup.map(function(elem) {
                                return elem.id
                            });
                            break;
                        case 'servicegroup':
                            templateDefaultValue = self.servicetemplateManager.currentServiceGroup.map(function(elem) {
                                return elem.id
                            });
                            break
                    }
                }
                if ($field.prop('disabled')) {
                    return
                }
                if (fieldType === 'checkbox') {
                    if (templateDefaultValue == '0') {
                        templateDefaultValue = !1
                    } else {
                        templateDefaultValue = !!templateDefaultValue
                    }
                    $field.prop('checked', templateDefaultValue).trigger('change')
                } else if (fieldType === 'select') {
                    $field.val(templateDefaultValue).trigger('chosen:updated').trigger('change')
                } else if (fieldType === 'radio') {
                    $field.parent().find('input').each(function() {
                        if ($(this).val() != templateDefaultValue) {
                            return
                        }
                        $(this).prop('checked', !0).trigger('change')
                    })
                } else if ($field.hasClass('slider')) {
                    var $otherInput = $field.parents('.form-group').find('input[type=number]');
                    $otherInput.val(templateDefaultValue).trigger('change');
                    $field.trigger('change')
                } else if ($field.hasClass('tagsinput')) {
                    var tags = templateDefaultValue.split(',');
                    $field.tagsinput('removeAll');
                    for (var key in tags) {
                        $field.tagsinput('add', tags[key])
                    }
                } else {
                    $field.val(templateDefaultValue).trigger('change')
                }
            },
            getFieldType: function($field) {
                var fieldType = $field.attr('type');
                if (!fieldType) {
                    fieldType = $field.prop('tagName').toLowerCase()
                }
                return fieldType
            },
            onChangeField: function(event) {
                var $field = $(this);
                var $label = null;
                var inputId = $field.attr('id') || '';
                var keyName;
                if (inputId.match(/stars-rating/)) {
                    keyName = getObjectKeyByValue(self.fieldMap, 'stars-rating-5')
                } else {
                    keyName = getObjectKeyByValue(self.fieldMap, inputId.replace(/^(Service)/, ''))
                }
                var templateDefaultValue = self.servicetemplateManager.currentTemplate[keyName];
                var templateDefaultTitle = '';
                if (typeof templateDefaultValue === 'undefined') {
                    templateDefaultValue = $field.prop('data-template-default')
                }
                if (in_array(keyName, ['contact', 'contactgroup', 'servicegroup'])) {
                    switch (keyName) {
                        case 'contact':
                            templateDefaultValue = self.servicetemplateManager.currentContact.map(function(elem) {
                                return elem.id
                            });
                            templateDefaultTitle = self.servicetemplateManager.currentContact.map(function(elem) {
                                return elem.name
                            });
                            break;
                        case 'contactgroup':
                            templateDefaultValue = self.servicetemplateManager.currentContactGroup.map(function(elem) {
                                return elem.id
                            });
                            templateDefaultTitle = self.servicetemplateManager.currentContactGroup.map(function(elem) {
                                return elem.Container.name
                            });
                            break;
                        case 'servicegroup':
                            templateDefaultValue = self.servicetemplateManager.currentServiceGroup.map(function(elem) {
                                return elem.id
                            });
                            templateDefaultTitle = self.servicetemplateManager.currentServiceGroup.map(function(elem) {
                                return elem.Container.name
                            });
                            break
                    }
                    templateDefaultTitle = templateDefaultTitle.join(', ')
                }
                var fieldType = self.servicetemplateManager.getFieldType($field);
                var nonDefaultClassName = 'fa fa-chain-broken fa-chain-non-default txt-color-red';
                var defaultClassName = 'fa fa-chain fa-chain-default txt-color-green';
                var defaultTitle = 'Default value';
                var restoreDefaultTitle;
                if (templateDefaultTitle != '') {
                    restoreDefaultTitle = 'Restore template default: "' + templateDefaultTitle + '"'
                } else {
                    restoreDefaultTitle = 'Restore template default: "' + templateDefaultValue + '"'
                }
                if (typeof templateDefaultValue === 'undefined' || templateDefaultValue === null) {
                    return
                }
                var fieldValue = null;
                switch (fieldType) {
                    case 'checkbox':
                        fieldValue = $field.is(':checked');
                        if (templateDefaultValue == '0') {
                            templateDefaultValue = !1
                        } else {
                            templateDefaultValue = !!templateDefaultValue
                        }
                        break;
                    case 'radio':
                        fieldValue = $field.parents('.form-group').find('[name="' + $field.attr('name') + '"]:checked').val();
                        break;
                    case 'select':
                        fieldValue = $field.val();
                        if (in_array(keyName, ['contact', 'contactgroup', 'servicegroup'])) {
                            if (fieldValue === null) {
                                fieldValue = []
                            }
                        } else {
                            restoreDefaultTitle = 'Restore default: "' + $field.find('option[value="' + templateDefaultValue + '"]').text() + '"'
                        }
                        break;
                    default:
                        fieldValue = $field.val();
                        break
                }
                if (fieldValue === null) {
                    return
                }
                var wrappedOnClickRestore = function() {
                        self.servicetemplateManager.onClickRestoreDefault.call($field)
                    },
                    $restoreDefaultIcon = $field.parents('.form-group').find('.fa-chain, .fa-chain-broken'),
                    isEqual = (is_scalar(fieldValue) && is_scalar(templateDefaultValue) && fieldValue == templateDefaultValue) || (is_array(fieldValue) && is_array(templateDefaultValue) && is_array_equal(fieldValue, templateDefaultValue));
                if (isEqual) {
                    if (!$restoreDefaultIcon.length) {
                        $restoreDefaultIcon = $('<i>', {
                            'class': defaultClassName,
                            'title': defaultTitle
                        });
                        $field.parents('.form-group').append($restoreDefaultIcon)
                    } else {
                        $restoreDefaultIcon.attr({
                            'class': defaultClassName,
                            'title': defaultTitle
                        }).off('click')
                    }
                } else {
                    if (!$restoreDefaultIcon.length) {
                        $restoreDefaultIcon = $('<i>', {
                            'class': nonDefaultClassName,
                            'title': restoreDefaultTitle
                        });
                        $restoreDefaultIcon.on('click', wrappedOnClickRestore);
                        if ($('#inheritContacts').prop('checked') && (keyName == 'contact' || keyName == 'contactgroup')) {} else {
                            $field.parents('.form-group').append($restoreDefaultIcon)
                        }
                    } else {
                        $restoreDefaultIcon.attr({
                            'class': nonDefaultClassName,
                            'title': restoreDefaultTitle
                        }).off('click').on('click', wrappedOnClickRestore)
                    }
                }
            },
            initRestoreDefault: function() {
                for (var key in self.fieldMap) {
                    if (!self.fieldMap.hasOwnProperty(key)) {
                        return
                    }
                    var $field = $('#Service' + self.fieldMap[key]);
                    var fieldType = $field.attr('type');
                    if (!fieldType && $field.prop('tagName') != null) {
                        fieldType = $field.prop('tagName').toLowerCase()
                    }
                    switch (fieldType) {
                        case 'text':
                        case 'checkbox':
                            self.servicetemplateManager.onChangeField.call($field);
                            $field.on('change.restoreDefault', self.servicetemplateManager.onChangeField);
                            $field.on('keyup', self.servicetemplateManager.onChangeField);
                            break;
                        case 'radio':
                            var $radioFields = $field.parents('.form-group').find('[name="' + $field.attr('name') + '"]');
                            $radioFields.each(function() {
                                self.servicetemplateManager.onChangeField.call($(this));
                                $(this).on('change.restoreDefault', function() {
                                    self.servicetemplateManager.onChangeField.call($(this))
                                })
                            });
                            break;
                        case 'select':
                            self.servicetemplateManager.onChangeField.call($field);
                            $field.on('change.restoreDefault', self.servicetemplateManager.onChangeField);
                            break;
                        case 'number':
                            self.servicetemplateManager.onChangeField.call($field);
                            $field.on('change.restoreDefault', self.servicetemplateManager.onChangeField);
                            break;
                        case 'default':
                            break
                    }
                }
                self.servicetemplateManager.isRestoreFunctionalityInitialized = !0;
                self.servicetemplateManager.isInitializedOnce = !0
            },
            updateServicetemplateValues: function(onComplete) {
                self.servicetemplateManager.currentTemplate = {};
                var $selectBoxServicetemplate = $('#ServiceServicetemplateId');
                var ajaxCompleteCallback = function(response) {
                    var responseObject = response.responseJSON;
                    if (responseObject.code === 'not_authenticated' || responseObject.servicetemplate.length == 0) {
                        return
                    }
                    var servicetemplateId = $selectBoxServicetemplate.val();
                    self.servicetemplateManager.currentTemplate = responseObject.servicetemplate.Servicetemplate;
                    self.servicetemplateManager.currentContact = responseObject.servicetemplate.Contact;
                    self.servicetemplateManager.currentContactGroup = responseObject.servicetemplate.Contactgroup;
                    self.servicetemplateManager.currentServiceGroup = responseObject.servicetemplate.Servicegroup;
                    self.servicetemplateManager.currentCustomVariables = responseObject.servicetemplate.Customvariable;
                    window.currentTemplate = responseObject.servicetemplate.Servicetemplate;
                    window.currentContact = responseObject.servicetemplate.Contact;
                    window.currentContactGroup = responseObject.servicetemplate.Contactgroup;
                    window.currentServiceGroup = responseObject.servicetemplate.Servicegroup;
                    window.currentCustomVariable = responseObject.servicetemplate.Customvariable;
                    if (self.servicetemplateManager.currentTemplate.id != servicetemplateId) {
                        self.Ajaxloader.hide();
                        return
                    }
                    if (self.servicetemplateManager.isInitializedOnce) {
                        for (var key in self.fieldMap) {
                            if (in_array(key, ['check_interval', 'retry_interval', 'notification_interval'])) {
                                self.updateSlider({
                                    value: responseObject.servicetemplate.Servicetemplate[key],
                                    selector: self.fieldMap[key]
                                })
                            } else if (key == 'priority') {
                                $('#Servicestars-rating-' + responseObject.servicetemplate.Servicetemplate[key]).prop('checked', !0).parents('.form-group').find('input[type=radio]')
                            } else if (key == 'tags') {
                                self.updateTags({
                                    tags: responseObject.servicetemplate.Servicetemplate[key]
                                })
                            } else if (in_array(key, ['notify_on_recovery', 'notify_on_warning', 'notify_on_unknown', 'notify_on_critical', 'notify_on_downtime', 'notify_on_flapping', 'notify_on_downtime', 'flap_detection_enabled', 'flap_detection_on_ok', 'flap_detection_on_warning', 'flap_detection_on_unknown', 'flap_detection_on_critical', 'is_volatile', 'freshness_checks_enabled', 'process_performance_data', 'active_checks_enabled'])) {
                                self.updateCheckbox({
                                    value: responseObject.servicetemplate.Servicetemplate[key],
                                    selector: self.fieldMap[key]
                                })
                            } else if (in_array(key, ['notify_period_id', 'command_id', 'check_period_id', 'eventhandler_command_id'])) {
                                self.updateSelectbox({
                                    value: responseObject.servicetemplate.Servicetemplate[key],
                                    selector: self.fieldMap[key]
                                })
                            } else {
                                $('#Service' + self.fieldMap[key]).val(responseObject.servicetemplate.Servicetemplate[key])
                            }
                        }
                        var selectedContacts = [];
                        $(responseObject.servicetemplate.Contact).each(function(intIndex, jsonContact) {
                            selectedContacts.push(jsonContact.id)
                        });
                        self.updateSelectbox({
                            value: selectedContacts,
                            selector: '#ServiceContact',
                            prefix: 'false'
                        });
                        var selectedContactgroups = [];
                        $(responseObject.servicetemplate.Contactgroup).each(function(intIndex, jsonContactgroup) {
                            selectedContactgroups.push(jsonContactgroup.id)
                        });
                        self.updateSelectbox({
                            value: selectedContactgroups,
                            selector: '#ServiceContactgroup',
                            prefix: 'false'
                        });
                        var selectedServicegroups = [];
                        $(responseObject.servicetemplate.Servicegroup).each(function(intIndex, jsonServicegroup) {
                            selectedServicegroups.push(jsonServicegroup.id)
                        });
                        self.updateSelectbox({
                            value: selectedServicegroups,
                            selector: '#ServiceServicegroup',
                            prefix: 'false'
                        })
                    }
                    var serviceHasOwnMacros = $('.service-macro-settings').find('input[type=hidden]').length > 0;
                    if (serviceHasOwnMacros) {
                        self.servicetemplateManager._activateOrUpdateMacroRestore()
                    } else {
                        self.CustomVariables.loadMacroFromTemplate(self.servicetemplateManager.currentTemplate.id, self.servicetemplateManager._activateOrUpdateMacroRestore)
                    }
                    self.Ajaxloader.hide();
                    onComplete()
                };
                var onChangeServicetemplate = function() {
                    self.servicetemplateManager.isRestoreFunctionalityInitialized = !0;
                    var templateId = parseInt($(this).val(), 10);
                    if (templateId <= 0) {
                        self.servicetemplateManager.currentTemplate = {};
                        self.servicetemplateManager.deactivateRestoreFunctionality();
                        return !1
                    }
                    $('#content').find('.fa-link').remove();
                    self.Ajaxloader.show();
                    $.ajax({
                        url: "/Services/loadTemplateData/" + encodeURIComponent(templateId) + ".json",
                        type: "POST",
                        cache: !1,
                        error: function() {},
                        success: function() {},
                        complete: ajaxCompleteCallback
                    })
                };
                if (parseInt($selectBoxServicetemplate.val(), 10) > 0) {
                    onChangeServicetemplate.call($selectBoxServicetemplate)
                } else {
                    self.servicetemplateManager.isInitializedOnce = !0
                }
                $selectBoxServicetemplate.on('change.serviceTemplate', function() {
                    onChangeServicetemplate.call(this);
                    var $serviceCommandId = $('#ServiceCommandId'),
                        $eventhandlerCommandId = $('#ServiceEventhandlerCommandId'),
                        $serviceTemplateId = $('#ServiceServicetemplateId');
                    self.loadParametersByCommandId($serviceCommandId.val(), $serviceTemplateId.val(), $('#CheckCommandArgs'));
                    self.loadNagParametersByCommandId($eventhandlerCommandId.val(), $('#ServiceServicetemplateId').val(), $('#EventhandlerCommandArgs'))
                })
            }
        };
        self.servicetemplateManager.init()
    },
    deleteService: function(id) {
        $.ajax({
            dataType: "json",
            url: '/services/delete/' + id + '.json',
            method: 'POST',
            data: {
                'angular': !0
            },
            success: function(response) {
                $('#successDelete').show();
                setTimeout(function() {
                    window.location.href = '/services/index/'
                }, 700)
            },
            error: function(request, status, error) {
                var errorMsg = request.responseJSON.message;
                var usedBy = request.responseJSON.usedBy;
                var errorHtml = '<div class="text-danger">';
                errorHtml += '<div class="text-danger">' + errorMsg + '</div>';
                for (var key in usedBy) {
                    errorHtml += '<div class="text-danger">';
                    errorHtml += '<i class="fa fa-times"></i>';
                    errorHtml += ' ';
                    errorHtml += '<a class="text-danger" href="' + usedBy[key].baseUrl + id + '">' + usedBy[key].message + '</a>';
                    errorHtml += '</div>'
                }
                errorHtml += '</div>';
                $('#errorOnDelete').html(errorHtml)
            }
        })
    },
    checkFlapDetection: function() {
        var disable = null;
        if (!$('input[type="checkbox"]#ServiceFlapDetectionEnabled').prop('checked')) {
            disable = !0
        }
        $('.flapdetection_control').prop('disabled', disable)
    },
    checkFreshnessSettings: function() {
        var readonly = null;
        if (!$('input[type="checkbox"]#ServiceFreshnessChecksEnabled').prop('checked')) {
            readonly = !0;
            $('#ServiceFreshnessThreshold').val('')
        }
        $('#ServiceFreshnessThreshold').prop('readonly', readonly)
    },
    updateTags: function(_options) {
        var options = _options || {};
        options.tags = _options.tags || "";
        options.remove = _options.remove || !0;
        if (options.remove === !0) {
            this.$tagsinput.tagsinput('removeAll')
        }
        this.$tagsinput.tagsinput('add', options.tags)
    },
    updateSlider: function(_options) {
        var options = _options || {};
        options.value = parseInt(_options.value, 10) || 0;
        options.selector = _options.selector || null;
        $('#Service' + options.selector).slider('setValue', options.value);
        $('#_Service' + options.selector).val(options.value);
        $('#Service' + options.selector).val(options.value);
        $('_#Service' + options.selector).trigger('keyup');
        var $helptext = $('#Service' + options.selector + '_human');
        var min = parseInt(options.value / 60, 10);
        var sec = parseInt(options.value % 60, 10);
        $helptext.html(min + " " + this.lang[1] + " " + this.lang[3] + " " + sec + " " + this.lang[2])
    },
    updateCheckbox: function(_options) {
        var options = _options || {};
        options.value = _options.value || null;
        options.selector = _options.selector || '';
        if (options.value === null || options.value == 0 || options.value == !1) {
            $('input[type="checkbox"]#Service' + options.selector).prop('checked', !1);
            this.checkFlapDetection();
            return !1
        }
        $('input[type="checkbox"]#Service' + options.selector).prop('checked', !0).trigger('change');
        this.checkFlapDetection();
        return !0
    },
    updateSelectbox: function(_options) {
        var options = _options || {};
        options.value = _options.value || 0;
        options.selector = _options.selector || '';
        options.prefix = _options.prefix || "#Service";
        if (options.prefix == 'false') {
            options.prefix = ''
        }
        $(options.prefix + options.selector).val(options.value);
        $(options.prefix + options.selector).trigger("chosen:updated").change()
    },
    loadParametersByCommandId: function(command_id, servicetemplate_id, $target) {
        var self = this;
        if (!command_id || !servicetemplate_id || !$target || !$target.length) {
            throw new Error('Invalid argument given')
        }
        this.Ajaxloader.show();
        $.ajax({
            url: '/Services/loadParametersByCommandId/' + encodeURIComponent(command_id) + '/' + encodeURIComponent(servicetemplate_id),
            type: 'POST',
            cache: !1,
            error: function() {},
            success: function() {},
            complete: function(response) {
                $target.html(response.responseText);
                self.Ajaxloader.hide()
            }
        })
    },
    loadNagParametersByCommandId: function(command_id, servicetemplate_id, $target) {
        var self = this;
        if (!command_id || !servicetemplate_id || !$target || !$target.length) {
            throw new Error('Invalid argument given')
        }
        this.Ajaxloader.show();
        $.ajax({
            url: '/Services/loadNagParametersByCommandId/' + encodeURIComponent(command_id) + '/' + encodeURIComponent(servicetemplate_id),
            type: 'POST',
            cache: !1,
            error: function() {},
            success: function() {},
            complete: function(response) {
                $target.html(response.responseText);
                self.Ajaxloader.hide()
            }
        })
    },
    loadParameters: function(command_id, $target) {
        this.Ajaxloader.show();
        $.ajax({
            url: "/Services/loadArgumentsAdd/" + encodeURIComponent(command_id),
            type: "POST",
            cache: !1,
            error: function() {},
            success: function() {},
            complete: function(response) {
                $target.html(response.responseText);
                this.Ajaxloader.hide()
            }.bind(this)
        })
    },
    loadParametersFromTemplate: function(servicetemplate_id) {
        $.ajax({
            url: "/Services/loadServicetemplatesArguments/" + encodeURIComponent(servicetemplate_id),
            type: "POST",
            cache: !1,
            error: function() {},
            success: function() {},
            complete: function(response) {
                $('#CheckCommandArgs').html(response.responseText);
                this.Ajaxloader.hide()
            }.bind(this)
        })
    },
    inherit: function() {
        $inheritCheckbox = $('#inheritContacts');
        if ($inheritCheckbox.prop('checked') == !0) {
            $('#serviceContactSelects').block({
                message: null,
                overlayCSS: {
                    opacity: 0.5,
                    cursor: 'not-allowed',
                    'background-color': 'rgb(255, 255, 255)'
                }
            });
            var Contact = this.getVar('ContactsInherited').Contact;
            if (Contact != null) {
                $('#ServiceContact').val('').trigger('chosen:updated');
                for (var contactId in Contact) {
                    if ($('#ServiceContact option[value="' + contactId + '"]').length > 0) {
                        $('#ServiceContact option[value="' + contactId + '"]').val(contactId).prop('selected', !0)
                    }
                }
                $('#ServiceContact').trigger('chosen:updated')
            }
            var Contactgroup = this.getVar('ContactsInherited').Contactgroup;
            if (Contactgroup != null) {
                $('#ServiceContactgroup').val('').trigger('chosen:updated');
                for (var ContactgroupId in Contactgroup) {
                    if ($('#ServiceContactgroup option[value="' + ContactgroupId + '"]').length > 0) {
                        $('#ServiceContactgroup option[value="' + ContactgroupId + '"]').val(ContactgroupId).prop('selected', !0)
                    }
                }
                $('#ServiceContactgroup').trigger('chosen:updated')
            }
            $('#ServiceContact').prop('readonly', !0);
            $('#ServiceContactgroup').prop('readonly', !0)
        } else {
            $('#serviceContactSelects').unblock();
            $('#ServiceContact').prop('readonly', !1);
            $('#ServiceContactgroupSelects').unblock();
            $('#ServiceContactgroup').prop('readonly', !1)
        }
    }
});
App.Controllers.DocumentationsViewController = Frontend.AppController.extend({
    $currentColor: null,
    $textarea: null,
    _initialize: function() {
        var self = this;
        this.$currentColor = $('#currentColor');
        this.$textarea = $('#docuText');
        $("[select-color='true']").click(function() {
            var color = $(this).attr('color');
            self.$textarea.surroundSelectedText('[color=' + color + ']', '[/color]')
        });
        $("[select-fsize='true']").click(function() {
            var fontSize = $(this).attr('fsize');
            self.$textarea.surroundSelectedText('[' + fontSize + ']', '[/' + fontSize + ']')
        });
        $('#insertWysiwygHyperlink').click(function() {
            var url = $('#url').val();
            var description = $('#description').val();
            var sel = self.$textarea.getSelection();
            self.$textarea.insertText('[url=' + url + ']' + description + '[/url]', sel.start, "collapseToEnd")
        });
        $("[wysiwyg='true']").click(function() {
            var task = $(this).attr('task');
            switch (task) {
                case 'bold':
                    self.$textarea.surroundSelectedText('[b]', '[/b]');
                    break;
                case 'italic':
                    self.$textarea.surroundSelectedText('[i]', '[/i]');
                    break;
                case 'underline':
                    self.$textarea.surroundSelectedText('[u]', '[/u]');
                    break;
                case 'left':
                    self.$textarea.surroundSelectedText('[left]', '[/left]');
                    break;
                case 'center':
                    self.$textarea.surroundSelectedText('[center]', '[/center]');
                    break;
                case 'right':
                    self.$textarea.surroundSelectedText('[right]', '[/right]');
                    break;
                case 'justify':
                    self.$textarea.surroundSelectedText('[justify]', '[/justify]');
                    break;
                case 'code':
                    self.$textarea.surroundSelectedText('[code]', '[/code]');
                    break
            }
        })
    }
});
App.Controllers.DocumentationsWikiController = Frontend.AppController.extend({
    _initialize: function() {
        var self = this;
        $('#search-documentation').keyup(function() {
            var searchKeyword = $.trim($(this).val()).toLowerCase();
            self.search(searchKeyword)
        });
        var inputField = document.getElementById('search-documentation');
        if (inputField !== null) {
            if (inputField.value.length > 0) {
                self.search(inputField.value.toLowerCase())
            }
        }
        $('#doku_back').click(function() {
            window.history.back()
        })
    },
    search: function(searchKeyword) {
        var $target;
        var $search = $('.docs-container');
        var $results = $('.wiki-search-results');
        if (searchKeyword !== '') {
            $search.hide();
            $results.html('');
            $results.show();
            $search.find('.search-results').each(function() {
                $target = $(this).children('h4').children('a').html() + ' ' + $(this).children('div').children('.description').html();
                if ($target.toLowerCase().match(searchKeyword)) {
                    $results.append($(this).clone())
                }
            })
        } else {
            $results.hide();
            $search.show()
        }
    }
});
App.Controllers.ChatIndexController = Frontend.AppController.extend({
    $chatUsers: null,
    $filterInput: null,
    $chatBody: null,
    $chatContainer: null,
    components: ['WebsocketChat'],
    _initialize: function() {
        this.$chatUsers = this.$('#chat-users');
        this.$filterInput = this.$('#filter-chat-list');
        this.$chatBody = this.$('#chat-body');
        this.$chatContainer = this.$('#chat-container');
        this.$chatContainer.find('.chat-list-open-close').click(this._onChatListToggle.bind(this));
        this._setupChatListFilter();
        this.WebsocketChat.setup(this.$('.chat-widget'), this.getVar('websocket_url'));
        this.WebsocketChat._errorCallback = function() {
            $('#error_msg').html('<div class="alert alert-danger alert-block"><a href="#" data-dismiss="alert" class="close">×</a><h5 class="alert-heading"><i class="fa fa-warning"></i> Error</h5>Could not connect to Chat Server</div>')
        }
        this.WebsocketChat.new_message = this.getVar('new_message');
        this.WebsocketChat.setUsername(this.getVar('username'));
        this.WebsocketChat.setUserId(this.getVar('user_id'));
        this.WebsocketChat.connect()
    },
    _onChatListToggle: function() {
        this.$chatContainer.toggleClass('open')
    },
    _setupChatListFilter: function() {
        jQuery.expr[':'].Contains = function(a, i, m) {
            return (a.textContent || a.innerText || "").toUpperCase().indexOf(m[3].toUpperCase()) >= 0
        };
        this.$filterInput.change(function(e) {
            var filter = $(e.currentTarget).val();
            if (filter) {
                this.$chatUsers.find("a:not(:Contains(" + filter + "))").parent().slideUp();
                this.$chatUsers.find("a:Contains(" + filter + ")").parent().slideDown()
            } else {
                this.$chatUsers.find("li").slideDown()
            }
            return !1
        }.bind(this)).keyup(function() {
            $(this).change()
        })
    }
});
App.Controllers.ConfigsIndexController = Frontend.AppController.extend({
    _initialize: function() {
        $('#saveContent').click(function() {
            $.post("/nagios_module/configs/saveConfig", {
                configfile: $('#ConfigConfigfile').val(),
                content: strip_tags($('.config_editor').html(), '<br>')
            }, function() {
                $("html, body").animate({
                    scrollTop: 0
                }, "slow");
                $('#flashMessage').show()
            })
        })
    },
});
App.Controllers.CmdIndexController = Frontend.AppController.extend({
    _initialize: function() {
        $('#CmdCommand').change(function() {
            $('.api_structure_container').hide();
            $('#' + $(this).val()).show()
        })
    },
})