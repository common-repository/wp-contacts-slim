jQuery(function ($) {  // use $ for jQuery
    "use strict";

	/* Modals */

	// edit existing lead - uses showLeadDiag()
    $(document).on('click', '.wcp-lead', function() {
        var leadID = $(this).attr('class').split(' ')[1].split('-')[2];
        $.post(WCP_Ajax.ajaxurl, {
            // wp ajax action
            action: 'ajax-wcpfrontend',
            // vars
            lead_id: leadID,
			edit_lead: 'true',
            nextNonce : WCP_Ajax.nextNonce,
			postID : WCP_Ajax.postID

        }, function(response) {
			if (response.logged_in == 'false') {
				showLogInDiag(response.title, response.body, response.login_button, response.close);
				return false;
			}
			showLeadDiag(response, leadID);
		});
		return false;
	});

	// Delete checkbox Check All
    $(document).on('click', '.select-all-checked', function() {
		if ($('.fixed-edits').length) {    // avoid duplicating counts (since fixed-edits would be cloned
			var checkBoxes = $('.fixed-edits input.delete-all');
		} else {
			var checkBoxes = $('input.delete-all');
		}
		checkBoxes.prop('checked', !checkBoxes.prop('checked'));
		$('.select-all-checked').toggle();
    });

	// Delete all selected verify
	$(document).on('click', '.delete-all-checked', function() {
		var checked = false;
		$('input.delete-all').each( function() {
			if ($(this).is(':checked')) {
				checked = 'yes';
			}
		});
		if (checked) {
			$.post(WCP_Ajax.ajaxurl, {
				// wp ajax action
            	action: 'ajax-wcpfrontend',
            	// vars
            	delete_all_checked: 'true',
            	nextNonce : WCP_Ajax.nextNonce,
            	postID : WCP_Ajax.postID

        	}, function(response) {
				var modalBody = '<div class="wcp-edit-lead row"><div class="col-md-12"><p>' + response.msg + '</p></div></div>';
				$('.wcp-modal').find('.modal-dialog').addClass('modal-lg');

            	$('.wcp-modal').find('.modal-title').html(response.title);
            	$('.wcp-modal').find('.modal-body').html(modalBody);
            	var footer = '<button type="button" class="btn btn-default" data-dismiss="modal">'
                        + response.cancel + '</button>'
                        + '<button type="button" class="btn btn-primary delete-all-confirm">' + response.confirm + '</button>';
            	$('.wcp-modal').find('.modal-footer').html(footer);
            	$('.wcp-modal').modal();
        	});
		}
        return false;
	});

	// Actually delete multiple entries
	$(document).on('click', '.delete-all-confirm', function() {
		var removeEntries = {};
		var i = 1;
		if ($('.fixed-edits').length) {
			var checkBoxes = $('.fixed-edits input.delete-all');
		} else {
			var checkBoxes = $('input.delete-all');
		}
		$(checkBoxes).each( function() {
            if ($(this).is(':checked')) {
            	var entryID= $(this).attr('class').split(' ')[1].split('-')[1];
            	removeEntries[i] = entryID;
				i++;
            }
        });
		if(removeEntries) {
			$.post(WCP_Ajax.ajaxurl, {
                // wp ajax action
                action: 'ajax-wcpfrontend',
                // vars
                delete_all_confirm: 'true',
				remove_entries : removeEntries,
                nextNonce : WCP_Ajax.nextNonce,
                postID : WCP_Ajax.postID

            }, function(response) {
				var total = 0;
				$.each(response.removed, function(k, v) {
					total++;	
					$('.wcp-table tr.wcp-lead-' + v).remove();
				});
				$('.wcp-modal').modal('hide');
            	addFixedEdits();
            	// get new lead count
            	var count = parseInt($(document).find('.lead-count span.wcp-primary').text());
            	var count = count - total;
            	$(document).find('.lead-count span.wcp-primary').text(count);
            });
        }
        return false;
	});

	 // add new lead - uses showLeadDiag()
    $(document).on('click', '.add-lead', function() {
        var leadID = 'new';
        $.post(WCP_Ajax.ajaxurl, {
            // wp ajax action
            action: 'ajax-wcpfrontend',
            // vars
            lead_id: leadID,
            new_lead: 'true',
            nextNonce : WCP_Ajax.nextNonce,
			postID : WCP_Ajax.postID

        }, function(response) {
			if (response.logged_in == 'false') {
                showLogInDiag(response.title, response.body, response.login_button, response.close);
                return false;
            }
			showLeadDiag(response, leadID);
        });
        return false;
    });

	function showLeadDiag(response, leadID) {
			var modalBody = '';
			var i = 1;
			modalBody = '<div class="wcp-edit-lead leadID-' + leadID + ' row">';
			$.each(response.translated, function(k,v) {
				if ('owned_by' == k) {  // Owners
					if (response.can_change_ownership == 'no' 
					){
						modalBody += '<div class="col-md-6"><div class="input-field">';
						modalBody += '<input class="lead_select ' + k + '" type="hidden" value="' + response.current_user + '" />'; 
						modalBody += '</div></div>';
					} else {
					
						modalBody += '<div class="col-md-6"><div class="input-field"><label for=' + k + '>' + v.trans + '</label>'
							  + '<select class="lead_select ' + k + ' input-select">';
						$.each(response.all_users, function(k2,v2) {
							var selected = '';
							if (leadID == 'new') {
								if (v2.data.user_login == response.current_user) {
									selected = 'selected="selected"';
								}
							} else if (v.value == v2.data.user_login) {
								selected = 'selected="selected"';
							}
							modalBody += '<option value="' + v2.data.user_login + '" ' + selected + '>' 
								   + v2.data.user_login + '</option>';
						});
						modalBody += '</select></div></div>';
					}

				} else {  // The rest of the fields

					var fieldType = 'na';
					$.each(response.sorting, function(k2,v2) {
						if (k == v2.orig_name) {
							fieldType = v2.field_type;
						}
					});

					if (v.type == '2' || v.type == '6') {
							modalBody += '<div class="col-md-6"><div class="input-field"><label for=' + k + '>' + v.trans 
									+ '</label><textarea class="lead_field ' 
									+ k + ' materialize-textarea">' + v.value + '</textarea></div></div>';

					} else if (fieldType == '10') { // Dropdowns
						modalBody += '<div class="col-md-6"><div class="input-field">'
								  + '<label for="' + k + '">' + v.trans + '</label>'
								  + '<select id="' + k + '" class="lead_select ' + k + ' dropdown-field input-select">';
						$.each(response.sst, function(k2,v2) {
                        	var selected = '';
                        	if (k == v2.sst_type_desc) {   // matching sst's
                            	if (v.value == v2.sst_id) { // selected
                                	selected = 'selected="selected"';
                            	}
                            	modalBody += '<option value="' + v2.sst_id + '" ' + selected + '>' + v2.sst_name + '</option>';
                        	}
                    	});
                    	modalBody += '</select></div></div>';

					} else if (fieldType == '7') { // datetime with datepicker needs class for it
						modalBody += '<div class="col-md-6"><div class="input-field"><label for=' + k + '>' + v.trans
                            + '</label><input class="lead_field '
                            + k + ' date-choice" value="' + v.value + '" type="text"></div></div>';

					} else if (fieldType == '11') { // date only with datepicker needs class for it
                        modalBody += '<div class="col-md-6"><div class="input-field"><label for=' + k + '>' + v.trans
                            + '</label><input class="lead_field '
                            + k + ' date-only-choice" value="' + v.value + '" type="text"></div></div>';

					} else if (v.type == '99') {
							modalBody += '<div class="col-md-12"><div class="input-field fields-grouptitle"><h3 for=' 
									+ k + '>' + v.trans 
									+ '</h3><input class="lead_field ' 
									+ k + '" value="" type="hidden"></div></div>';
					
					} else {
						modalBody += '<div class="col-md-6"><div class="input-field"><label for=' + k + '>' + v.trans 
								+ '</label><input class="lead_field ' 
								+ k + '" value="' + v.value + '" type="text"></div></div>';
					}
				}
			});
			modalBody += '</div>';
			// add large class to modal (remove for smaller ones)
			$('.wcp-modal').find('.modal-dialog').addClass('modal-lg');

			$('.wcp-modal').find('.modal-title').html(response.title);
        	$('.wcp-modal').find('.modal-body').html(modalBody);
        	var footer = '<button type="button" class="btn btn-default" data-dismiss="modal">' 
						+ response.cancel_button + '</button>'
                   		+ '<button type="button" class="btn btn-primary wcp-save-lead">' + response.save_button + '</button>';
        	$('.wcp-modal').find('.modal-footer').html(footer);
        	$('.wcp-modal').modal({backdrop: 'static', keyboard: false});
			selectFieldGenerate();

			$('.date-choice').datetimepicker({
            	dateFormat : WCP_Ajax.dateFormat,
				timeFormat : WCP_Ajax.timeFormat,
				changeYear: true,
			    yearRange: '-150:+50'
        	});
			
			$('.date-only-choice').datepicker({
                dateFormat : WCP_Ajax.dateFormat,
                changeYear: true,
                yearRange: '-150:+50'
            });			

			// Since date-choice is essentially a nested modal it's enforceFocus method
			// must be no-op'd or the following error results 
			// "Uncaught RangeError: Maximum call stack size exceeded"
			// But then when the nested modal is hidden we reset modal.enforceFocus
			var enforceModalFocusFn = $.fn.modal.Constructor.prototype.enforceFocus;
			$.fn.modal.Constructor.prototype.enforceFocus = function() {};
			$('.date-choice').on('hidden', function() {
    			$.fn.modal.Constructor.prototype.enforceFocus = enforceModalFocusFn;
			});
			$('.date-choice').modal({ backdrop : false }).css('padding-right','0'); // clear bootstrap padding and backdrop

			$('.date-only-choice').on('hidden', function() {
                $.fn.modal.Constructor.prototype.enforceFocus = enforceModalFocusFn;
            });
            $('.date-only-choice').modal({ backdrop : false }).css('padding-right','0'); // clear bootstrap padding and backdrop	
	
			select2_init();

    };
	
	function select2_init() {
		$('.multi-select-field').select2({});
    }

    select2_init();

	// Save the lead
	$('.wcp-modal').on('click', '.wcp-save-lead', function() {
        var leadID = $('.wcp-edit-lead').attr('class').split(' ')[1].split('-')[1];
        var fieldVals = {};
		var dropdownFields = {};
		var multiSelect = {};
        $('.lead_field, .lead_select').each( function() {
            var name = $(this).attr('class').split(' ')[1];
            var value = $(this).val();
			if ($(this).hasClass('dropdown-field')) { // dropdown build name association
				var sst_name = $('option:selected', this).text();
                dropdownFields[value] = sst_name;
			}
			if ($(this).hasClass('multi-select-field')) { // multi select build name association
				$('option:selected', this).each( function() {
					//alert($(this).text() + ' ' + $(this).val());
					var sst_name = $('option:selected', this).text();
					multiSelect[$(this).val()] = $(this).text();
				});
				//multiSelect[value] = sst_name;
			}
            fieldVals[name] = value;
        });

		// checkboxes
        $('.wcp-edit-lead .checkbox').each( function() {
            var name = $(this).attr('class').split(' ')[1];
            var value = ( $(this).is(':checked') ) ? 1 : 0;
            fieldVals[name] = value;
        });

        $.post(WCP_Ajax.ajaxurl, {
            // wp ajax action
            action: 'ajax-wcpfrontend',
            // vars
            save_lead         : 'true',
            lead_id           : leadID,
            nextNonce         : WCP_Ajax.nextNonce,
			postID            : WCP_Ajax.postID,
            field_vals        : fieldVals,
			dropdown_fields   : dropdownFields,
			multiselect_fields: multiSelect,
        }, function(response) {
			if (response.logged_in == 'false') {
                showLogInDiag(response.title, response.body, response.login_button, response.close);
                return false;
            } else if (response.required == 'true') { // required input needed
			    alert(response.required_msg);
				return false;
			}
            $('.wcp-modal').modal('hide');
            var i = 0;
            var row = '';
			var shwcp_root_url = response.shwcp_root_url;
			if (response.new != 'true') {  // existing, add links and images
				var imageTD = $('.wcp-lead-' + response.lead_id + ' .image-td').prop('outerHTML');
				var individualLink = $('.wcp-lead-' + response.lead_id).find('.individual-link').attr('href');
            	var editTD = $('.wcp-lead-' + response.lead_id + ' .edit-td').html();
			} else {  // New lead, add default image if using images
				if (response.contact_image_used == 'true') {  // Using images
					var imageTD = '<td class="image-td" style="background:transparent url('
						+ response.default_thumb + ') no-repeat 20px center;"></td>';
				} else {
					var imageTD = '';
				}
				var individualLink = '?wcp=entry&entry=' + response.lead_id;
				var editTD = '<span class="wcp-lead lead-id-' + response.lead_id + '">'
						   + '<i class="wcp-sm md-create"> </i>'
						   + '</span> '
						   + '<span class="delete-lead">'
						   + '<i class="wcp-red wcp-sm md-remove-circle-outline"> </i></span> '
					       + '<span class="delete-all-selected">'
                           + '<input id="wcp-delete-all-' + response.lead_id + '" '
                           + 'class="delete-all delete-' + response.lead_id + '" type="checkbox" />'
                           + '<label for="wcp-delete-all-' + response.lead_id + '"> </label></span>';

				var count = parseInt($(document).find('.lead-count span.wcp-primary').text());
            	var count = count + 1;
            	$(document).find('.lead-count span.wcp-primary').text(count);
			}

			row += imageTD;

            $.each(response.output_fields, function(k,v) {
				var tdContent = '';
				var dataTH = '';
				$.each(response.sorting, function(sk, sv) {  // layout field types
					if (sv.orig_name == k) { // match up sorting for each field to get the field type display
						dataTH = sv.translated_name;
						if (sv.orig_name == 'lead_files') { // Lead Files
							tdContent = v;  // already formatted on ajax side

						} else if (sv.field_type == '2') { // Text area
							tdContent = '<a class="individual-link" href="' + individualLink + '">' + v + '</a>';
						} else { // default
							 tdContent = '<a class="individual-link" href="' + individualLink + '">' + v + '</a>';
						}
					}
				});
				row += '<td data-th="' + dataTH + '">' + tdContent + '</td>';
                i++;
            });
			row += '<td class="edit-td">' + editTD + '</td>';
			if (response.new == 'true') {
				var fullrow = '<tr class="wcp-row1 wcp-lead-' + response.lead_id + '">' + row + '</tr>';
				$('.wcp-table tr.header-row').after(fullrow);
			} else {
            	$('.wcp-table tr.wcp-lead-' + response.lead_id).html(row);
			}
			$('.wcp-lead-' + response.lead_id + ' .rateit').rateit();
			addFixedEdits();
            $('.wcp-table tr.wcp-lead-' + response.lead_id).effect("highlight", {color: WCP_Ajax.contactsColor}, 2000);
            //alert(response.message);
        });
        //$('.wcp-modal').modal('hide');
        return false;
    });

	// Delete lead Form
	$(document).on('click', '.delete-lead', function() {
		var leadID = $(this).closest('tr').attr('class').split(' ')[1].split('-')[2];

		var headers = [];
        var fields = [];
		$('.header-row').find('th').each(function() {
			if ($(this).hasClass('edit-header')
				|| $(this).hasClass('contact-image')
			){
                    // ignore
            } else {
            	headers.push($(this).text());
			}
        });
		$('.wcp-table').find('.wcp-lead-' + leadID).find('td').each( function() {
			if (!$(this).hasClass('image-td')) {
				fields.push($(this).text());
			}
		});
		
		var modalBody = '';

		$.post(WCP_Ajax.ajaxurl, {
            // wp ajax action
            action: 'ajax-wcpfrontend',
            // vars
            delete_lead  : 'true',
            lead_id    : leadID,
            nextNonce  : WCP_Ajax.nextNonce,
			postID     : WCP_Ajax.postID
        }, function(response) {
			if (response.logged_in == 'false') {
                showLogInDiag(response.title, response.body, response.login_button, response.close);
                return false;
            }
		
			modalBody += '<div class="wcp-edit-lead row">';
			var i = 0;
			var total = $(headers).length;
			$(headers).each(function(k, v) {
				modalBody += '<div class="col-md-6">'
						   + '<label for="del-' + v + '">' + v + '</label><span class="lead_field del-' + v + '">' 
						   + fields[i] + '</span></div>';
				i++;
			});
			modalBody += '</div>';
				
            // add large class to modal (remove for smaller ones)
            $('.wcp-modal').find('.modal-dialog').addClass('modal-lg');

            $('.wcp-modal').find('.modal-title').html(response.title);
            $('.wcp-modal').find('.modal-body').html(modalBody);
            var footer = '<button type="button" class="btn btn-default" data-dismiss="modal">'
                        + response.cancel_button + '</button>'
                        + '<button type="button" class="btn btn-primary confirm-delete-lead lead-' + response.lead_id + '">' 
						+ response.confirm_button + '</button>';
            $('.wcp-modal').find('.modal-footer').html(footer);
            $('.wcp-modal').modal();
		});
	});

	// Delete lead confirmation
	$(document).on('click', '.confirm-delete-lead', function() {
		var leadID = $(this).attr('class').split(' ')[3].split('-')[1];
		$.post(WCP_Ajax.ajaxurl, {
            // wp ajax action
            action: 'ajax-wcpfrontend',
            // vars
            confirm_delete_lead  : 'true',
            lead_id    : leadID,
            nextNonce  : WCP_Ajax.nextNonce,
			postID     : WCP_Ajax.postID
        }, function(response) {
			if (response.logged_in == 'false') {
                showLogInDiag(response.title, response.body, response.login_button, response.close);
                return false;
            }
			$('.wcp-modal').modal('hide');
			$('.wcp-table tr.wcp-lead-' + response.lead_id).remove();
			addFixedEdits();
			// get new lead count
			var count = parseInt($(document).find('.lead-count span.wcp-primary').text());
			var count = count - 1;
			$(document).find('.lead-count span.wcp-primary').text(count);

		});
	});

	/* Front End Export Form */
	$(document).on('click', '.export-view', function() {
		var modalBody = '';
		var getParams = $(document).find('.export-query').html(); // get the hidden Get query parameters
        $.post(WCP_Ajax.ajaxurl, {
            // wp ajax action
            action: 'ajax-wcpfrontend',
            // vars
            export_view  : 'true',
            nextNonce  : WCP_Ajax.nextNonce,
            postID     : WCP_Ajax.postID
        }, function(response) {
            if (response.logged_in == 'false') {
                showLogInDiag(response.title, response.body, response.login_button, response.close);
                return false;
            }

            modalBody += '<div class="export-front-view row">'
				       + '<form action="' + response.export_url + '" class="export-front-form" method="POST">'
					   + '<div class="col-md-12"><input type="checkbox" id="allfields" class="allfields" />'
					   + '<label for="allfields">' + response.all_text + '</label></p><hr /></div>'
					   + response.field_choices
					   + '<div class="col-md-6 col-sm-12"><hr /><div class="input-field"><label for="export-type">' 
					   + response.format_text
                       + '</label><select id="export-type" class="input-select" name="output-type">'
                       + '<option value="csv">' + response.csv_text + '</option>'
                       + '<option value="excel">' + response.excel_text + '</option>'
                       + '</select></div></div>'
					   + '<input type="hidden" name="front_page" value="true" />'
					   + '<input type="hidden" name="action" value="wcpexport">'
					   + '<input type="hidden" name="postID" value="' + WCP_Ajax.postID + '" />'
					   + getParams
					   + '</form></div>';

            // add large class to modal (remove for smaller ones)
            $('.wcp-modal').find('.modal-dialog').addClass('modal-lg');

            $('.wcp-modal').find('.modal-title').html(response.title);
            $('.wcp-modal').find('.modal-body').html(modalBody);
            var footer = '<button type="button" class="btn btn-default" data-dismiss="modal">'
                        + response.cancel_button + '</button>'
                        + '<button type="button" class="btn btn-primary export-front-button">'
                        + response.confirm_button + '</button>';
            $('.wcp-modal').find('.modal-footer').html(footer);
            $('.wcp-modal').modal();
			selectFieldGenerate();
        });
	});

	/* Front End Export check all fields */
    $(document).on('click', '.allfields', function() {
        $('.export-field').each( function() {
            if ($('.allfields').is(':checked')) {
                $(this).attr("checked", true);
            } else {
                $(this).attr("checked", false);
            }
        });
    });

	/* Submit Front End Export Form */
	$(document).on('click', '.export-front-button', function(e) {
		var count_check = $(".export-field:checked").length;
        if (count_check == 0) {
            var modalBody = '';
            $.post(WCP_Ajax.ajaxurl, {
                // wp ajax action
                action: 'ajax-wcpfrontend',
                // vars
                export_nofields: 'true',
                nextNonce  : WCP_Ajax.nextNonce,
                postID     : WCP_Ajax.postID
            }, function(response) {

                modalBody += response.body;
                // add large class to modal (remove for smaller ones)
                $('.wcp-modal').find('.modal-dialog').addClass('modal-lg');

                $('.wcp-modal').find('.modal-title').html(response.title);
                $('.wcp-modal').find('.modal-body').html('<p class="modal-paragraph">' + modalBody + '</p>');
                var footer = '<button type="button" class="btn btn-default" data-dismiss="modal">'
                        + response.cancel_button + '</button>';
                $('.wcp-modal').find('.modal-footer').html(footer);
                $('.wcp-modal').modal();
            });
            return false;
		} else {
			$('.export-front-form').submit();
			$('.wcp-modal').modal('hide');
			return false;
		}
	});

	/* Front Sorting */
    $(document).on('mousedown touchstart', '.keepers li, .nonkeepers li', function() {
        $(this).addClass('active-elem');
    });
    $(document).on('mouseup touchend', '.keepers li, .nonkeepers li', function() {
        $(this).removeClass('active-elem');
    });

	/* Front Filters */
	$(document).on('mousedown touchstart', '.filter-keepers li, .filter-nonkeepers li', function() {
        $(this).addClass('active-elem');
    });
    $(document).on('mouseup touchend', '.filter-keepers li, .filter-nonkeepers li', function() {
        $(this).removeClass('active-elem');
    });

	/* Field Sorting */
	$(document).on('mousedown touchstart', '.wcp-fields .wcp-fielddiv', function() {
        $(this).addClass('active-fielddiv');
    });
    $(document).on('mouseup touchend', '.wcp-fields .wcp-fielddiv', function() {
        $(this).removeClass('active-fielddiv');
    });

    $(function() {
        $('.keepers, .nonkeepers').sortable ({
            connectWith: '.front-sorting',
			stop: function(event, ui) {
                updateFrontFields();
            }
        });
    });

	// Front page filters
	$(function() {
		$('.filter-keepers, .filter-nonkeepers').sortable ({
			connectWith: '.front-filters',
			stop: function(event, ui) {
                updateFrontFilters();
            }
		});
	});

	/* Update Front Fields */
	var updateFrontFields = function() {
	    var keepersArray = {};
        var nonKeepersArray = {};
        var orig_name;
        var translated_name;
        var inc = 0;
        $('.keepers').find('li').each( function() {
            inc++;
            orig_name = $(this).attr('class').split(' ')[1];
            translated_name = $(this).text();
            keepersArray[inc] = {
                orig_name : orig_name,
                translated_name : translated_name
            }
        });
        $('.nonkeepers').find('li').each( function() {
            inc++;
            orig_name = $(this).attr('class').split(' ')[1];
            translated_name = $(this).text();
            nonKeepersArray[inc] = {
                orig_name : orig_name,
                translated_name : translated_name
            }
        });
        var keepers = keepersArray;
        var nonKeepers = nonKeepersArray;

        $.post(WCP_Ajax.ajaxurl, {
            // wp ajax action
            action: 'ajax-wcpfrontend',
            // vars
            frontend_sort: 'true',
            nextNonce : WCP_Ajax.nextNonce,
            postID : WCP_Ajax.postID,
            keepers: keepers,
            nonkeepers: nonKeepers

        }, function(response) {
            if (response.logged_in == 'false') {
                showLogInDiag(response.title, response.body, response.login_button, response.close);
                return false;
            }
            //alert(response.message);
            //$('.save-sorting').addClass('saved').delay(5000).queue(function() {
             //   $('.save-sorting').removeClass('saved').dequeue();
            //});
        });
        return false;
    };

    /* Update Front Filters */
	var updateFrontFilters = function() {
        var keepersArray = {};
        var nonKeepersArray = {};
        var orig_name;
        var translated_name;
        var inc = 0;
        $('.filter-keepers').find('li').each( function() {
            inc++;
            orig_name = $(this).attr('class').split(' ')[1];
            translated_name = $(this).text();
            keepersArray[inc] = {
                orig_name : orig_name,
                translated_name : translated_name
            }
        });
        $('.filter-nonkeepers').find('li').each( function() {
            inc++;
            orig_name = $(this).attr('class').split(' ')[1];
            translated_name = $(this).text();
            nonKeepersArray[inc] = {
                orig_name : orig_name,
                translated_name : translated_name
            }
        });
        var keepers = keepersArray;
        var nonKeepers = nonKeepersArray;

        $.post(WCP_Ajax.ajaxurl, {
            // wp ajax action
            action: 'ajax-wcpfrontend',
            // vars
            frontend_filter: 'true',
            nextNonce : WCP_Ajax.nextNonce,
            postID : WCP_Ajax.postID,
            keepers: keepers,
            nonkeepers: nonKeepers

        }, function(response) {
            if (response.logged_in == 'false') {
                showLogInDiag(response.title, response.body, response.login_button, response.close);
                return false;
            }
            //alert(response.message);
            //$('.save-filters').addClass('saved').delay(5000).queue(function() {
            //    $('.save-filters').removeClass('saved').dequeue();
            //});
        });
        return false;
    };
	
    // Duplicate all selected verify
    $(document).on('click', '.duplicate-all-checked', function() {
        var checked = false;
        $('input.delete-all').each( function() {
            if ($(this).is(':checked')) {
                checked = 'yes';
            }
        });
        if (checked) {
            $.post(WCP_Ajax.ajaxurl, {
                // wp ajax action
                action: 'ajax-wcpfrontend',
                // vars
                duplicate_all_checked: 'true',
                nextNonce : WCP_Ajax.nextNonce,
                postID : WCP_Ajax.postID

            }, function(response) {
                var modalBody = '<div class="wcp-edit-lead row"><div class="col-md-12"><p>' + response.msg + '</p></div></div>';
                $('.wcp-modal').find('.modal-dialog').addClass('modal-lg');

                $('.wcp-modal').find('.modal-title').html(response.title);
                $('.wcp-modal').find('.modal-body').html(modalBody);
                var footer = '<button type="button" class="btn btn-default" data-dismiss="modal">'
                        + response.cancel + '</button>'
                        + '<button type="button" class="btn btn-primary duplicate-all-confirm">' + response.confirm + '</button>';
                $('.wcp-modal').find('.modal-footer').html(footer);
                $('.wcp-modal').modal();
            });
        }
        return false;
    });

	// Actually duplicate multiple entries
    $(document).on('click', '.duplicate-all-confirm', function() {
        var duplicateEntries = {};
        var i = 1;
        if ($('.fixed-edits').length) {
            var checkBoxes = $('.fixed-edits input.delete-all');
        } else {
            var checkBoxes = $('input.delete-all');
        }
        $(checkBoxes).each( function() {
            if ($(this).is(':checked')) {
                var entryID= $(this).attr('class').split(' ')[1].split('-')[1];
                duplicateEntries[i] = entryID;
                i++;
            }
        });
        if(duplicateEntries) {
            $.post(WCP_Ajax.ajaxurl, {
                // wp ajax action
                action: 'ajax-wcpfrontend',
                // vars
                duplicate_all_confirm: 'true',
                duplicate_entries : duplicateEntries,
                nextNonce : WCP_Ajax.nextNonce,
                postID : WCP_Ajax.postID

            }, function(response) {
                $('.wcp-modal').modal('hide');

                window.location.href = location.href;

            });
        }
        return false;
    });



	/* End Front Sorting */

	/* Manage Individual Page */
    $(document).on('mousedown touchstart', '.man-left-side li, .man-right-side li, .man-bottom li', function() {
        $(this).addClass('active-tile');
    });
	$(document).on('mouseup touchend', '.man-left-side li, .man-right-side li, .man-bottom li', function() {
        $(this).removeClass('active-tile');
    });

	$(function() {
		$('.man-left-side, .man-right-side, .man-bottom').sortable({
			connectWith: '.man-ind',
			stop: function(event, ui) {
				updateIndividual();
			}
		});
	});

	// Width adjustment for columns 
	var changeColumns = function(value) {
		//var value = $(this).val();
		var rightSide = 12 - value;
		$('.manage-individual .left-column').removeClass(
			function (index, className) {
				return (className.match (/(^|\s)col-md-\S+/g) || []).join(' ');
			}).addClass('col-md-' + value);
		$('.manage-individual .right-column').removeClass(
			function (index, className) {
				return (className.match(/(^|\s)col-md-\S+/g) || []).join(' ');
			}).addClass('col-md-' + rightSide);
	};

	// slider
	$( function() {
		var value = WCP_Ajax.indColumns; // individual columns value from options
		var handle = $('#slide-handle');
  		$(".left-col-width").slider({
			range: "min",
			min: 2,
			value: value,
			max: 10,
			create: function() {
				handle.text( $(this).slider("value"));
			},
			slide: function(event, ui) {
				handle.text( ui.value);
				changeColumns(ui.value);
				updateIndividual(ui.value);
			}
		});
  	});
	
	// Tile status
	$(document).on('click', '.ind-status', function() {
		var status = $(this).attr('class').split(' ')[1];
		var enabledText  = $(document).find('.enabled-text').text();
		var disabledText = $(document).find('.disabled-text').text();
		if (status == 'enabled') {
			$(this).removeClass('enabled').addClass('disabled');
			$(this).find('i').removeClass('md-done').addClass('md-clear').attr('title', disabledText);
			var disabledOverlay = '<div class="disabled-overlay"></div>';
			$(this).closest('li').find('.disabled-overlay').removeClass('notshown');
		} else {
			$(this).removeClass('disabled').addClass('enabled');
            $(this).find('i').removeClass('md-clear').addClass('md-done').attr('title', enabledText);
			$(this).closest('li').find('.disabled-overlay').addClass('notshown');
		}
		updateIndividual();
		return false;
	});

	// Update individual management settings
	var updateIndividual = function(columns) {
		var getColumns= $(document).find('.left-col-width').slider("option", "value");
		columns = columns || getColumns;
		//if (!columns) {
		//	var columns= $(document).find('.left-col-width').slider("option", "value");
		//}
		var tiles = {};
		var inc = 1;
		$('.ind-tile').each( function() {
			var side;
			if ($(this).parent('ul').hasClass('man-left-side')) {
				side = 'keep-left';
			} else if ($(this).parent('ul').hasClass('man-right-side')) {
				side = 'keep-right';
			} else if ($(this).parent('ul').hasClass('man-bottom')) {
				side = 'keep-bottom';
			}
			var status = $(this).find('.ind-status').attr('class').split(' ')[1];
			var tile = $(this).attr('class').split(' ')[1];
			tiles[inc] = {
				tile : tile,
                side : side,
                status : status,
            };
			inc++;
		});
		//alert(tiles.toSource());
		$.post(WCP_Ajax.ajaxurl, {
            action: 'ajax-wcpfrontend',
            // vars
            manage_individual: 'true',
            nextNonce : WCP_Ajax.nextNonce,
            postID    : WCP_Ajax.postID,
			tiles	  : tiles,
			columns   : columns
        }, function(response) {
            if (response.logged_in == 'false') {
                showLogInDiag(response.title, response.body, response.login_button, response.close);
                return false;
            } else if (response.saved) {
				//alert('saved');
			}
		});
	};	

	/* End Manage Individual Page */


	/* Manage Fields */

	// load dropdowns
	$(document).on('click', '.dropdown-options-tab', function() {
		$('.options-div').html(''); // clear out anything left
		var dropdownLabel = $(document).find('.dropdown-label').text();
		var defaultOption = $(document).find('.default-option').text();
		$.post(WCP_Ajax.ajaxurl, {
			action: 'ajax-wcpfrontend',
			// vars
			manage_dropdowns: 'true',
			nextNonce : WCP_Ajax.nextNonce,
            postID    : WCP_Ajax.postID,
        }, function(response) {
            if (response.logged_in == 'false') {
                showLogInDiag(response.title, response.body, response.login_button, response.close);
                return false;
            } else if (response.dropdowns) {
				var newDropdown = '<div class="input-field">'
								+ '<label for="dropdown-options">' + dropdownLabel + '</label>'
								+ '<select class="dropdown-select input-select" id="dropdown-options">'
								+ '<option value="">' + defaultOption + '</option>';
								
				$.each(response.dropdowns, function(k,v) {
					newDropdown += '<option value="' + k + '">' + v + '</option>';
                });
				newDropdown += '</select>';
				$('.dropdown-container').html(newDropdown);
				selectFieldGenerate();
			}
		});
	});

	// Get dropdown options after change
	$(document).on('change', '.dropdown-container select.input-select', function() {
		var selected = $(this).find(':selected').val();
		if (selected) {
			//alert(selected);	
			$.post(WCP_Ajax.ajaxurl, {
				action:  'ajax-wcpfrontend',
				// vars
				dropdown_select: 'true',
				dropdown_list: selected,
				nextNonce : WCP_Ajax.nextNonce,
				postID    : WCP_Ajax.postID,
			}, function(response) {
				if (response.logged_in == 'false') {
                	showLogInDiag(response.title, response.body, response.login_button, response.close);
                	return false;
            	} else if (response.options) {
					var toggleText = $(document).find('.toggle-text').text();
					var sortText = $(document).find('.sort-text').text();
					var optionsText = $(document).find('.options-text').text();
					var addOptionText = $(document).find('.add-option-text').text();
					var saveOptionsText = $(document).find('.save-options-text').text();

					var optionsDiv = '<div class="wcp-button save-options">' + saveOptionsText + '</div>'
								   + '<h4>' + optionsText + '<i class="add-option wcp-md md-add-circle" title="' 
								   + addOptionText + '"></i></h4>'
								   + '<div class="options-div-holder">';

					$.each(response.options, function(k,v) {
						optionsDiv += '<div class="wcp-selops optid-' + v.sst_id + '">'
									+ '<input class="wcp-selname" value="' + v.sst_name + '" type="text">'
									+ '<i class="remove-option wcp-red wcp-md md-remove-circle-outline" title="' 
									+ toggleText + '"></i>'
									+ '<i class="option-sort wcp-md md-sort" title="' + sortText + '"></i>'
									+ '</div>';
				
					});
					optionsDiv += '</div>';
					$('.options-div').html(optionsDiv);
					$(function() {
        				$('.options-div-holder').sortable ({});
    				});
					/* options-div sorting */
    				$(document).on('mousedown touchstart', '.wcp-selops', function() {
        				$(this).addClass('active-selops');
    				});
    				$(document).on('mouseup touchend', '.wcp-selops', function() {
        				$(this).removeClass('active-selops');
    				});
				}
			});
		} else { // none selected, empty div
			$('.options-div').html('');
		}
	});

	// Add Dropdown Option
    $(document).on('click', '.add-option', function() {
        // set a unique identifier to set the id on saves
        var unique = randomString();
        var entry = $(this).closest('.options-container').find('.option-clone').html();
        var wrap = '<div class="wcp-selops option-new"></div>';
        $(this).closest('.options-div').find('.options-div-holder').prepend(wrap);
        $(this).closest('.options-div').find('.options-div-holder div:first').attr('data-unique', unique);
        $(this).closest('.options-div').find('.options-div-holder div:first').hide().prepend(entry).slideDown();
    });

	// Remove Dropdown Option
    $(document).on('click', '.remove-option', function() {
		// Make sure there's at least 1 to avoid problems
		var atleastoneWarning = $(document).find('.atleastone-warning').text();
		var numberRemove = $('.removal-set').length;
		numberRemove = numberRemove + 1;
		var numberOptions = $('.wcp-selops').length;
		if (numberRemove == numberOptions) {
			alert(atleastoneWarning);
			return;
		}
        $(this).closest('div').addClass('removal-set');
        $(this).closest('div').find('input').addClass('remove').attr('disabled', 'disabled');
        $(this).removeClass('remove-sst wcp-red md-remove-circle-outline').addClass('no-remove-sst md-highlight-remove');
    });

	// Unset Remove Dropdown Option
    $(document).on('click', '.no-remove-option', function() {
        $(this).closest('div').removeClass('removal-set');
        $(this).closest('div').find('input').removeClass('remove').removeAttr('disabled');
        $(this).removeClass('no-remove-sst md-highlight-remove').addClass('remove-sst wcp-red md-remove-circle-outline');
    });

	// Save Dropdown Options
	$(document).on('click', '.save-options', function() {
		var optList = {};
		var inc = 1;
		var sst_type_desc = $('.dropdown-select').find(':selected').val();
		$('.options-div-holder .wcp-selops').each(function() {
			var action = 'update';
			var sst_id = $(this).attr('class').split(' ')[1].split('-')[1];
			var sst_name = $(this).find('.wcp-selname').val().trim();
			var unique = '';
			if ($(this).hasClass('option-new')) { // new options
				action = 'add';
				sst_id = "new";
				unique = $(this).data('unique');
			}

			if ($(this).hasClass('removal-set')) { // Remove Option
				action = 'delete';
			}
			optList[inc] = {
				sst_name : sst_name,
				sst_type_desc : sst_type_desc,
				action : action,
				unique: unique,
				sst_id: sst_id,
			}
			inc++;
		});

		$.post(WCP_Ajax.ajaxurl, {
            // wp ajax action
            action: 'ajax-wcpfrontend',
            // vars
            save_dropdown_options: 'true',
            nextNonce            : WCP_Ajax.nextNonce,
            postID               : WCP_Ajax.postID,
            optlist              : optList,
			sst_type_desc        : sst_type_desc
        }, function(response) {
			if (response.logged_in == 'false') {
                showLogInDiag(response.title, response.body, response.login_button, response.close);
                return false;
            }
            $('.removal-set').slideUp("400", function() {$(this).remove();} );

            var newOptions = response.new_options;
            $('.option-new').each( function() {
                var unique = $(this).data('unique');
                var newOption = $(this);
                $.each(newOptions, function(k,v) {
                    if (k == unique) {
                        newOption.removeClass().addClass('wcp-selops optid-' + v + ' ui-sortable-handle');
                    }
                });
            });

            $('.save-options').addClass('saved').delay(5000).queue(function() {
                $('.save-options').removeClass('saved').dequeue();
            });
        });
        return false;

	});

	// save fields
	$(document).on('click', '.save-fields', function() {
		var fieldList = {};
		var inc = 1;
		$('.wcp-fielddiv').each( function() {
			var action = 'update';
			var orig_name = $(this).find('.wcp-field').attr('class').split(' ')[1];
			var trans_name = $(this).find('.wcp-field').val().trim();
			var field_type = $(this).find('.field-type:checked').val();
			var required = $(this).find('.required-field').is(':checked') ? 1 : 0;
			if (!field_type) {
				field_type = '1'; // Default text field (also all non changeables
			}

			if (trans_name == '') {  // unchanged field
				trans_name = orig_name;
			}

			var unique = '';
			if ($(this).find('.wcp-field').hasClass('new-field')) {  // New Field
				action = 'add';
				unique = $(this).closest('.wcp-fielddiv').data('unique');
			} else if ($(this).find('.wcp-field').hasClass('delete-field')) { // Remove Field
				action = 'delete';
			}
			fieldList[inc] = {
				orig_name  : orig_name,
				trans_name : trans_name,
				field_type : field_type,
				required   : required,
				action     : action,
				unique     : unique
			}
			inc++;
		});

		$.post(WCP_Ajax.ajaxurl, {
			// wp ajax action
			action: 'ajax-wcpfrontend',
			// vars
			manage_fields: 'true',
			nextNonce : WCP_Ajax.nextNonce,
			postID    : WCP_Ajax.postID,
			fieldlist : fieldList
		}, function(response) {
			if (response.logged_in == 'false') {
                showLogInDiag(response.title, response.body, response.login_button, response.close);
                return false;
            }
			$('.delete-field').closest('.wcp-fielddiv').slideUp("400", function() {$(this).remove();} );
			var newFields = response.new_fields;
			$('.new-field').each( function() {
                var unique = $(this).closest('.wcp-fielddiv').data('unique');
                var newField = $(this);
                $.each(newFields, function(k,v) {
                    if (v.unique == unique) {
                        newField.removeClass('new-field').addClass(v.column);
						newField.closest('.input-field').find('label').attr('for',v.column).text(v.column);
                    }
                });
            });
			$('.save-fields').addClass('saved').delay(5000).queue(function() {
                $('.save-fields').removeClass('saved').dequeue();
            });
		});
		return false;
	});

	// Remove field click
	$(document).on('click', '.remove-field', function() {
		$(this).closest('.wcp-fielddiv').addClass('removal-set');
		$(this).closest('.wcp-fielddiv').find('.wcp-field').addClass('delete-field').attr('disabled', 'disabled');
		$(this).removeClass('remove-field wcp-red md-remove-circle-outline')
			.addClass('cancel-remove no-remove-field md-highlight-remove');
	});

	$(document).on('click', '.cancel-remove', function() {
		$(this).closest('.wcp-fielddiv').removeClass('removal-set');
		$(this).removeClass('cancel-remove no-remove-field md-highlight-remove')
			.addClass('remove-field wcp-red md-remove-circle-outline')
		$(this).closest('.wcp-fielddiv').find('.wcp-field').removeClass('delete-field').removeAttr('disabled');
	});

	// add field click
	$(document).on('click', '.add-field', function() {
		var unique = randomString();
		var text = $(document).find('.new-text').text();
		var fieldTypeText   = $(document).find('.field-type-text').text();
		var textFieldText   = $(document).find('.textfield-text').text();
		var textAreaText    = $(document).find('.textarea-text').text();
		var dateOnlyText    = $(document).find('.date-only-text').text();
		var dropdownText    = $(document).find('.dropdown-text').text();
		var requiredText    = $(document).find('.required-text').text();
		var groupTitleText  = $(document).find('.group-title-text').text();
		var newFieldHolder = '<div class="wcp-fielddiv"></div>';
		var newField = '<div class="wcp-group input-field"><label class="field-label" for="new-field">' + text + '</label>'
					 + '<input class="wcp-field new-field" type="text" value="' + text + '" />'
					 + '</div><div class="field-options-title"><span>' + textFieldText + '</span></div>'

					 + '<div class="field-options-holder">'
                     + '<i class="field-options wcp-md md-data-usage" title="' + fieldTypeText + '"></i>'
                     + '<div class="popover-material">'
                     + '<input type="radio" class="field-type" name="' + unique + '-type" value="1" checked="checked"'
					 + ' data-text="' + textFieldText + '" />'
                     +  textFieldText + '<br />'
                     + '<input type="radio" class="field-type" name="' + unique + '-type" value="2"'
					 + ' data-text="' + textAreaText + '" />' + textAreaText + '<br />'
					 + '<input type="radio" class="field-type" name="' + unique + '-type" value="11"'
                     + ' data-text="' + dateOnlyText + '" />'+ dateOnlyText + '<br />'
					 + '<input type="radio" class="field-type" name="' + unique + '-type" value="10"'
                     + ' data-text="' + dropdownText + '" />' + dropdownText + '<br />'
					 + '<input type="radio" class="field-type" name="' + unique + '-type" value="99"'
                     + ' data-text="' + groupTitleText + '" />'+ groupTitleText + '<br />'
                     + '</div></div>'

					 + '<i class="wcp-md md-sort"> </i>'
					 
					 + '<div class="required-field-holder"><input type="checkbox"'
                     + ' id="' + unique + '-req" class="required-field" />'
                     + '<label for="' + unique + '-req">' + requiredText + '</label></div>';					 
					 
		$('.wcp-fields').prepend(newFieldHolder);
		$('.wcp-fields').find('.wcp-fielddiv:first').attr('data-unique', unique);
		$('.wcp-fields .wcp-fielddiv:first').hide().prepend(newField).slideDown();
	});

	$(function() {
        $('.wcp-fields').sortable ({});
    });

	// datetime conversion warning message and required check
	$(document).on('click', '.popover-material input', function() {
		var value = $(this).val();
		if (value == '7') {
			var warning = $(document).find('.date-field-warning .warning-message').text();
			var title = $(document).find('.date-field-warning .warning-title').text();
			var close = $(document).find('.date-field-warning .warning-close').text();

            // add large class to modal (remove for smaller ones)
            $('.wcp-modal').find('.modal-title').html(title);
            $('.wcp-modal').find('.modal-body').html('<p>' + warning + '</p>');
            var footer = '<button type="button" class="btn btn-primary closemodal" data-dismiss="modal">'
                        + close + '</button>';
            $('.wcp-modal').find('.modal-footer').html(footer);
            $('.wcp-modal').modal();
		}

		var requiredField =  $(this).closest('.wcp-fielddiv').find('.required-field-holder');
		if (value == 8        // Remove required check for fields that don't need it
			|| value == 9
			|| value == 10
			|| value == 99
	    ) {	
			requiredField.remove();
		} else { 
			if (!requiredField.length) {
				var unique = $(this).closest('.wcp-fielddiv').data('unique');
			 	if (!unique) {
				 	unique = $(this).closest('.wcp-fielddiv').find('.wcp-field').attr('id');
				}
			 	var requiredText = $(document).find('.required-text').text();
				var required = '<div class="required-field-holder"><input type="checkbox"'
				             + ' id="' + unique + '-req" class="required-field" />'
					         + '<label for="' + unique + '-req">' + requiredText + '</label></div>';
				$(this).closest('.wcp-fielddiv').append(required);
			}
		}

		// display new text 
		var thisText = $(this).filter(':checked').data('text');
		$(this).closest('.wcp-fielddiv').find('.field-options-title').text(thisText);
			

	});

	/* End Manage Fields */

	/* Start file upload sections */
	// drag & drop indication for all file uploads
    $('#browse_file, #upload_files, #browse_import').on('dragenter', function() {
        $(this).addClass('dragover');
    });
    $('#browse_file, #upload_files, #browse_import').on('dragleave', function() {
        $(this).removeClass('dragover');
    });

	/* Image upload - Single lead image */
	var myUploader = new plupload.Uploader({
		drop_element: 'browse_file',
    	browse_button: 'browse_file', // id of the browser button
    	multipart: true,              // <- this is important because you want
                                  //    to pass other data as well
    	url: WCP_Ajax.ajaxurl,
		filters: {
			max_file_size: '10mb',
			mime_types: [
				{title : "Image files", extensions : "jpg,jpeg,gif,png"},
				//{title : "Zip files", extensions : "zip"}
			]
		},
  	});

	// hide submit on load
	$('.submit-lead-image').hide();

  	myUploader.init();

  	myUploader.bind('FilesAdded', function(up, files){
		var removeText = $(document).find('.remove-image-text').text();
		$.each(files, function(i, file) {
			$('.lead-image-file').append('<div class="addedFile" id="' + file.id + '">' 
				+ file.name + ' (' + plupload.formatSize(file.size) + ') <a href="#" id="' 
				+ file.id + '" class="remove-image">' + removeText + '</a>'
			);
		});
		$('.submit-lead-image').show();
  	});

	// Error Alert /////////////////////////////////////////////
    // If an error occurs an alert window will popup with the error code and error message.
    // Ex: when a user adds a file with now allowed extension
    myUploader.bind('Error', function(up, err) {
        alert("Error: " + err.code + ", Message: " + err.message + (err.file ? ", File: " + err.file.name : "") + "");
        up.refresh(); // Reposition Flash/Silverlight
    });

	// Remove file button //////////////////////////////////////
    // On click remove the file from the queue
    $(document).on('click', '.remove-image', function(e) {
        myUploader.removeFile(myUploader.getFile(this.id));
        $('#'+this.id).remove();
        e.preventDefault();
    });

	// Progress bar ////////////////////////////////////////////
    // Add the progress bar when the upload starts
    // Append the tooltip with the current percentage
    myUploader.bind('UploadProgress', function(up, file) {
		var progressDecimal = (up.total.percent / 100);
		var mprogress = new Mprogress({
            //start: false,  // start it now
            parent: '.progress-container'
        });
        mprogress.set(progressDecimal);
		$('.progress-percent').show();
        $('.progress-percent').text(up.total.percent + '%');		
    });

  	// before upload starts, get the value of the other fields
  	// and send them with the file
  	myUploader.bind('BeforeUpload', function(up) {
		var lead_id = $('.lead-image-container').attr('class').split(' ')[2].split('-')[1];
    	myUploader.settings.multipart_params = {
      		action: 'ajax-wcpfrontend',
			nextNonce : WCP_Ajax.nextNonce,
			postID : WCP_Ajax.postID,
			upload_small_image: 'true',
			lead_id: lead_id
      	// add your other fields here...    
    	};
  	});

  	// equivalent of the your "success" callback
  	myUploader.bind('FileUploaded', function(up, file, ret){   
		var response = JSON.parse(ret.response);
		if (response.logged_in == 'false') {
            showLogInDiag(response.title, response.body, response.login_button, response.close);
            return false;
        }
		//alert(response.new_file_url);
		$('.current-image').attr('src', response.new_file_url + '?' + Math.random());
		$('.submit-lead-image').hide();
		$('.lead-image-file').html('');
		$('.progress-percent').hide();
    	//console.log(ret);  
  	});

  	// trigger submission when this button is clicked
  	$('.submit-lead-image').on('click', function(e) {
    	myUploader.start();
    	e.preventDefault();      
  	});

	/* End Image Upload */


	/* Import csv, excel file upload */
		var maxFiles = 1;
	    var myUploader3 = new plupload.Uploader({
        drop_element: 'browse_import',
        browse_button: 'browse_import', // id of the browser button
        multipart: true,              // <- this is important because you want
                                  //    to pass other data as well
		multi_selection: false,     // One file
        max_file_count: maxFiles,
        url: WCP_Ajax.ajaxurl,
        filters: {
            max_file_size: '1000mb',
            mime_types: [
                {title : "Excel files", extensions : "csv,xls,xlsx"},
            ]
        },
    });

    // hide submit on load
    $('.submit-upload').hide();

    myUploader3.init();


    myUploader3.bind('FilesAdded', function(up, files){
		if (files.length > 1) { myUploader3.splice(1, files.length); }
		var inc = 0;
        $.each(files, function(i, file) {
			if (inc < 1) {
            	$('.import-file').append('<div class="addedFile" id="' + file.id + '">'
                	+ file.name + ' (' + plupload.formatSize(file.size) + ') <a href="#" id="'
                	+ file.id + '" class="remove-file">Remove</a>'
            	);
			}
			inc++;
        });
        $('.submit-upload').show();
    });

    // Error Alert /////////////////////////////////////////////
    // If an error occurs an alert window will popup with the error code and error message.
    // Ex: when a user adds a file with now allowed extension
    myUploader3.bind('Error', function(up, err) {
        alert("Error: " + err.code + ", Message: " + err.message + (err.file ? ", File: " + err.file.name : "") + "");
        up.refresh(); // Reposition Flash/Silverlight
    });

    // Remove file button //////////////////////////////////////
    // On click remove the file from the queue
    $(document).on('click', '.remove-file', function(e) {
       myUploader3.removeFile(myUploader3.getFile(this.id));
        $('#'+this.id).remove();
        e.preventDefault();
    });

    // Progress bar ////////////////////////////////////////////
    // Add the progress bar when the upload starts
    // Append the tooltip with the current percentage
    myUploader3.bind('UploadProgress', function(up, file) {
		var progressDecimal = (up.total.percent / 100);
		var mprogress = new Mprogress({
            //start: false,  // start it now
            parent: '.progress-container'
        });
		mprogress.set(progressDecimal);
		$('.progress-percent').show();
        $('.progress-percent').text(up.total.percent + '%');
    });

    // before upload starts, get the value of the other fields
    // and send them with the file
    myUploader3.bind('BeforeUpload', function(up) {
        myUploader3.settings.multipart_params = {
            action: 'ajax-wcpfrontend',
            nextNonce : WCP_Ajax.nextNonce,
			postID    : WCP_Ajax.postID,
            upload_import: 'true'
        };
    });

    // equivalent of the your "success" callback
    myUploader3.bind('FileUploaded', function(up, file, ret){
        var response = JSON.parse(ret.response);

		if (response.logged_in == 'false') {
            showLogInDiag(response.title, response.body, response.login_button, response.close);
            return false;
        }

		var totalRows = response.totalRows - 1; // Subract the header row
		var totalRowText = response.totalRowText;
		var topColumns = response.topColumns;
		var output = '<h3>' + response.step + '</h3><br /><br />'
				   + '<div class="row">';
		$.each(topColumns[0], function(k,v) {
			if ( v == 'ID' || v == 'id') {
				output += '<div class="imp-col hidden">' +
						  '<input type="hidden" class="db-column" id="column' + k + '" value="ID"></div>'; // do not display
			} else {
				output += '<div class="imp-col col-lg-4 col-md-4 col-sm-6">'
					+ '<div class="input-field">'
					+ '<label for="column' + k + '">' + v + '</label>'
					+ '<select class="db-column input-select" id="column' + k + '">'
					+ '<option value="not-assigned">' + response.none + '</option>';

				$.each(response.fields, function(k, v) {
					if (v.orig_name != 'id'
						&& v.orig_name != 'creation_date'
						&& v.orig_name != 'updated_date'
						&& v.orig_name != 'created_by'
						&& v.orig_name != 'updated_by'
						&& v.orig_name != 'owned_by'
					) {   // Don't add id's or special fields to selection
						output += '<option value="' + v.orig_name + '">' + v.translated_name + '</option>';
					}
				});
				output += '</select></div></div>';
			}
			
		});
		output += '</div><div class="import-summary"><span class="total-rows">' + totalRows + '</span>'
			 	 + ' ' + totalRowText + '</div><div class="wcp-button step2-import">' + response.continue + '</div>'
				 + '<div class="progress"><div class="progress-container"> &nbsp;</div>'
				 + ' <span class="progress-percent"></span></div>'
				 + ' <span class="complete-text">' + response.completeText + '</span>'
				 + ' <span class="new-file-loc">' + response.new_file + '</span>'
				 + ' <span class="update-entries">' + response.update_entries + '</span>';
		
		var importDiv = $('.import-container');
		$(importDiv).html(output);
		$('.progress-percent').hide();
		selectFieldGenerate();
    });

    // trigger submission when this button is clicked
    $('.submit-upload').on('click', function(e) {
        myUploader3.start();
        e.preventDefault();
    });


	/* End Import file upload */

	/* Import file step 3 */
	$(document).on('click', '.step2-import', function() {
		// updates progress bar with results
		var newFileLoc = $('.new-file-loc').text();
		var updateEntries = $('.update-entries').text();
		var fieldMap = {}; 
		var inc = 0;
        $('.imp-col').each( function() {
			var fileCol = $(this).find('label').text();
			var dbCol = $(this).find('.db-column').val();
			if (dbCol != 'not-assigned') {
				fieldMap[inc] = {
                	fileCol : fileCol,
                	dbCol   : dbCol
            	}
			}
			inc++;
        });
		var totalRows = $('.total-rows').text();
		var mprogress = new Mprogress({
        	//start: false,  // start it now
            parent: '.progress-container'
        });
		var progressShown = false;

		$.ajax({
			type: 'POST',
			dataType: 'json',
			url: WCP_Ajax.ajaxurl,
			cache: false,
			data: {action: 'ajax-wcpfrontend', import_step3: 'true', nextNonce: WCP_Ajax.nextNonce, postID: WCP_Ajax.postID,
				   fieldMap: fieldMap, totalRows: totalRows, new_file_loc: newFileLoc, update_entries: updateEntries},

			// handler
    		xhr: function () {
					var xhr = new window.XMLHttpRequest();
                    xhr.addEventListener("progress", function(e){
						var totalRows = parseInt($('.total-rows').text());
						// get the latest response which will be the last entry
						var resp = e.currentTarget.response;
						var current = resp.split(',');
						var latest = current[current.length - 1];


						if (!isNaN(latest)) {
							var decimalValue = ( latest / totalRows );
							decimalValue = decimalValue.toFixed(1);
							decimalValue = parseFloat( decimalValue );
							var percentValue = Math.round((latest / totalRows) * 100);
							latest = parseInt(latest);
							if (!progressShown) {
								mprogress.start();
								mprogress.set(decimalValue);
								$('.progress-percent').show();
								$('.progress-percent').text(percentValue + '%');
								progressShown = true;
							} else {
								$('.progress-percent').text(percentValue + '%');
								mprogress.set(decimalValue);
							}
								
    	                	console.log(latest);
						}
                    });
                return xhr;

            },

			beforeSend: function () {
				//alert('before send');
    		},
    		complete: function () {
				if (progressShown) {
					var complete = $('.complete-text').text();
					var successMsg = $('.success-message').text();
                	$('.progress-percent').text(complete);
					var success = '<h3><i class="md-done-all wcp-primary"></i>  ' + successMsg + '</h3>';
                	mprogress.end();
					progressShown = false; // reset
					$('.import-container').html(success);
				}
    		},
    		success: function (json) {
				//alert('data received');
				if (json.error) {   // error reporting
                	var modalBody = '<p>' + json.errormsg + '</p>';
                    var footer = '<button type="button" class="btn btn-default" data-dismiss="modal">'
                               + json.dismiss_button + '</button>';
                    $('.wcp-modal').find('.modal-title').html(json.title);
                    $('.wcp-modal').find('.modal-body').html(modalBody);
                    $('.wcp-modal').find('.modal-footer').html(footer);
                    $('.wcp-modal').modal();
                    return false;
                } else {
				}

				//alert(json.toSource());
    		}
		});
			
		//alert(fieldMap.toSource());

	});
	/* End Import file step 3

	/* Remove Lead Files */

	$(document).on('click', '.remove-existing-file', function() {
		var leadID = $(document).find('.lead-files-container').attr('class').split(' ')[1].split('-')[1];
		var leadFile = $(this).closest('.lead-info').find('.leadfile-link').text();
        var modalBody = '';

        $.post(WCP_Ajax.ajaxurl, {
            // wp ajax action
            action: 'ajax-wcpfrontend',
            // vars
            remove_file_check : 'true',
            lead_id    : leadID,
			lead_file  : leadFile,
            nextNonce  : WCP_Ajax.nextNonce,
			postID     : WCP_Ajax.postID
        }, function(response) {
			if (response.logged_in == 'false') {
                showLogInDiag(response.title, response.body, response.login_button, response.close);
                return false;
            }

            modalBody +=  response.message;

            // add large class to modal (remove for smaller ones)
            $('.wcp-modal').find('.modal-dialog').addClass('modal-lg');
            $('.wcp-modal').find('.modal-title').html(response.title);
            $('.wcp-modal').find('.modal-body').html(modalBody);
            var footer = '<button type="button" class="btn btn-default" data-dismiss="modal">'
                        + response.cancel_button + '</button>'
                        + '<button type="button" class="btn btn-primary confirm-remove-file">'
                        + response.confirm_button + '</button>';
            $('.wcp-modal').find('.modal-footer').html(footer);
            $('.wcp-modal').modal();
        });
		return false;
    });

	/* Actually remove file */
	$(document).on('click', '.confirm-remove-file', function() {
		var leadID = $('.remove-file-confirm').attr('class').split(' ')[1].split('-')[1];
		var leadFile = $('.file-remove-name').text();
		$.post(WCP_Ajax.ajaxurl, {
			action: 'ajax-wcpfrontend',
			//vars
			remove_file_confirm : 'true',
			lead_id : leadID,
			lead_file : leadFile,
			nextNonce : WCP_Ajax.nextNonce,
			postID    : WCP_Ajax.postID
		}, function(response) {
			if (response.logged_in == 'false') {
                showLogInDiag(response.title, response.body, response.login_button, response.close);
                return false;
            }

			var leadInfo = '';

			if (response.removed == 'yes') {
				$.each(response.files, function(k,v) {
					var shwcp_upload_url = response.shwcp_upload_url;
					var leadUrl = shwcp_upload_url + '/' + leadID + '-files/' + v.name;
					var fileLink = '<a class="leadfile-link" href="' + leadUrl + '">' + v.name + '</a>';

					// replace files with new list
					leadInfo += '<div class="lead-info">'
                          + '<span class="leadfile-name" title="' + v.name + ' ' + response.lastMod 
                          + ' ' + v.date + '">'
                          + fileLink + '</span>'
                          + '<span class="leadfile-size">' + v.size
                          + ' <i class="wcp-red wcp-md md-remove-circle-outline remove-existing-file"> </i></span>'
                          + '</div>';
				});
				$('.existing-files').find('.lead-info').remove();
				$('.existing-files').append(leadInfo);
			} else {
				// there was a problem
			}
			$('.wcp-modal').modal('hide');
		});
		return false;
	});



	/* End Remove Files */

	/* Multiple Files Upload */

	/* Files upload - Lead Files upload */
    var myUploader2 = new plupload.Uploader({
        drop_element: 'upload_files',
        browse_button: 'upload_files', // id of the browser button
        multipart: true,              // <- this is important because you want
                                  //    to pass other data as well
        url: WCP_Ajax.ajaxurl,
        filters: {
            max_file_size: '1000mb',
			chunk_size: '1mb',
            mime_types: [
                //{title : "All files", extensions : "jpg,gif,png"},
                //{title : "Zip files", extensions : "zip"}
            ]
        },
    });

    // hide submit on load
    $('.submit-lead-files').hide();

    myUploader2.init();

    myUploader2.bind('FilesAdded', function(up, files){
        $.each(files, function(i, file) {
            $('.files-queued').append('<div class="addedFile" id="' + file.id + '">'
                + file.name + ' (' + plupload.formatSize(file.size) + ') <a href="#" id="'
                + file.id + '" class="remove-file">Remove</a>'
            );
        });
        $('.submit-lead-files').show();
		$('.files-queued').slideDown();
    });

    // Error Alert /////////////////////////////////////////////
    // If an error occurs an alert window will popup with the error code and error message.
    // Ex: when a user adds a file with now allowed extension
    myUploader2.bind('Error', function(up, err) {
        alert("Error: " + err.code + ", Message: " + err.message + (err.file ? ", File: " + err.file.name : "") + "");
        up.refresh(); // Reposition Flash/Silverlight
    });

    // Remove file button //////////////////////////////////////
    // On click remove the file from the queue
    $(document).on('click', '.remove-file', function(e) {
        myUploader2.removeFile(myUploader2.getFile(this.id));
        $('#'+this.id).remove();
        e.preventDefault();
    });

    // Progress bar ////////////////////////////////////////////
    // Add the progress bar when the upload starts
    // Append the tooltip with the current percentage
    myUploader2.bind('UploadProgress', function(up, file) {
		var progressDecimal = (up.total.percent / 100);
		var mprogress = new Mprogress({
            parent: '.progress-container2'
        });
        mprogress.set(progressDecimal);
		$('.progress-percent2').show();
        $('.progress-percent2').text(up.total.percent + '%');

    });

	// before upload starts, get the value of the other fields
    // and send them with the file
    myUploader2.bind('BeforeUpload', function(up) {
        var lead_id = $('.lead-files-container').attr('class').split(' ')[1].split('-')[1];
        myUploader2.settings.multipart_params = {
            action: 'ajax-wcpfrontend',
            nextNonce : WCP_Ajax.nextNonce,
			postID    : WCP_Ajax.postID,
            upload_lead_files: 'true',
            lead_id: lead_id
        // add your other fields here...    
        };
    });

    // equivalent of the your "success" callback
    myUploader2.bind('FileUploaded', function(up, file, ret){
        var resp = JSON.parse(ret.response);

		if (resp.logged_in == 'false') {
            showLogInDiag(response.title, response.body, response.login_button, response.close);
            return false;
        }

        //alert(resp.new_file_url);
		var leadID = resp.lead_id;
		var lastMod = resp.lastMod;
		var upload_url = resp.file_url;
		var leadUrl = upload_url + '/' + leadID + '-files/' + resp.file_name;
        var fileLink = '<a class="leadfile-link" href="' + leadUrl + '">' + resp.file_name + '</a>';

		var file = '<div class="lead-info">'
                 + '<span class="leadfile-name" title="' + resp.file_name + ' ' + resp.lastMod
                 + ' ' + resp.file_date + '">'
                 + fileLink + '</span>'
                 + '<span class="leadfile-size">' + resp.file_size
                 + ' <i class="wcp-red wcp-md md-remove-circle-outline remove-existing-file"> </i></span>'
                 + '</div>';

		$('.existing-files').append(file);
        $('.submit-lead-files').hide();
        $('.files-queued').html('');
		$('.files-queued').slideUp();
		$('.progress-percent2').hide();
		var filesMsg = $('.files-msg').text();
		$('.lead-files-container .files-message').text(filesMsg);
        //console.log(ret);  
    });

    // trigger submission when this button is clicked
    $('.submit-lead-files').on('click', function(e) {
        myUploader2.start();
        e.preventDefault();
    });

	/* End Multiple Files Upload */

	/* Notes Funtionality */
	$(document).on('click', '.add-note', function() {
		var leadID = $(document).find('.lead-notes-container').attr('class').split(' ')[1].split('-')[1];

        var modalBody = '';
        $.post(WCP_Ajax.ajaxurl, {
            // wp ajax action
            action: 'ajax-wcpfrontend',
            // vars
            add_note   : 'true',
            lead_id    : leadID,
            nextNonce  : WCP_Ajax.nextNonce,
			postID     : WCP_Ajax.postID
        }, function(response) {
			if (response.logged_in == 'false') {
                showLogInDiag(response.title, response.body, response.login_button, response.close);
                return false;
            }

            modalBody += '<textarea id="notes-area"></textarea>';

            // add large class to modal (remove for smaller ones)
            $('.wcp-modal').find('.modal-dialog').addClass('modal-lg');

            $('.wcp-modal').find('.modal-title').html(response.title);
            $('.wcp-modal').find('.modal-body').html(modalBody);
            var footer = '<button type="button" class="btn btn-default" data-dismiss="modal">'
                        + response.cancel_button + '</button>'
                        + '<button type="button" class="btn btn-primary save-note lead-' + response.lead_id + '">'
                        + response.confirm_button + '</button>';
            $('.wcp-modal').find('.modal-footer').html(footer);
            $('.wcp-modal').modal();

			// initialize tinymce
			tinymce.remove('notes-area');
			tinyMCE.init({
				mode: 'exact',
				elements: 'notes-area',
				menubar: false
			});
        });
		return false;
    });

	/* Edit Note */
	$(document).on('click', '.edit-note', function() {
		 var leadID = $(this).closest('.lead-note').attr('class').split(' ')[1].split('-')[1];
		 var noteID = $(this).closest('.lead-note').attr('class').split(' ')[2].split('-')[1];
		 var modalBody = '';
		 $.post(WCP_Ajax.ajaxurl, {
            // wp ajax action
            action: 'ajax-wcpfrontend',
            // vars
            edit_note  : 'true',
            lead_id    : leadID,
			note_id    : noteID,
            nextNonce  : WCP_Ajax.nextNonce,
			postID     : WCP_Ajax.postID
        }, function(response) {
            if (response.logged_in == 'false') {
                showLogInDiag(response.title, response.body, response.login_button, response.close);
                return false;
            }

            modalBody += '<textarea id="notes-area">' + response.note + '</textarea>';

            // add large class to modal (remove for smaller ones)
            $('.wcp-modal').find('.modal-dialog').addClass('modal-lg');

            $('.wcp-modal').find('.modal-title').html(response.title);
            $('.wcp-modal').find('.modal-body').html(modalBody);
            var footer = '<button type="button" class="btn btn-default" data-dismiss="modal">'
                        + response.cancel_button + '</button>'
                        + '<button type="button" class="btn btn-primary save-edit-note lead-' + response.lead_id + ' ' 
						+ 'note-' + response.note_id + '">'
                        + response.confirm_button + '</button>';
            $('.wcp-modal').find('.modal-footer').html(footer);
            $('.wcp-modal').modal();

            // initialize tinymce
            tinymce.remove('notes-area');
            tinyMCE.init({
                mode: 'exact',
                elements: 'notes-area',
                menubar: false
            });
        });
        return false;
    });

	// Save edited note
	$(document).on('click', '.save-edit-note', function() {
		var noteID = $(this).attr('class').split(' ')[4].split('-')[1];
		var leadID = $(this).attr('class').split(' ')[3].split('-')[1];
		var note = tinyMCE.get('notes-area');
		$.post(WCP_Ajax.ajaxurl, {
			// wp ajax action
			action: 'ajax-wcpfrontend',
			//vars
			save_edit_note : 'true',
			lead_id        : leadID,
			note_id        : noteID,
			note           : note.getContent(),
			nextNonce	   : WCP_Ajax.nextNonce,
			postID         : WCP_Ajax.postID
		}, function(response) {
			if (response.logged_in == 'false') {
                showLogInDiag(response.title, response.body, response.login_button, response.close);
                return false;
            }
			$('.wcp-modal').modal('hide');
			$(document).find('.noteID-' + noteID).find('.timeline-body').html(response.note)
			$(document).find('.noteID-' + noteID).effect("highlight", {color: WCP_Ajax.contactsColor}, 2000);
		});
	});

	// Save new note
	$(document).on('click', '.save-note', function() {
		var leadID = $(this).attr('class').split(' ')[3].split('-')[1];
		var note = tinyMCE.get('notes-area');
		$.post(WCP_Ajax.ajaxurl, {
            // wp ajax action
            action: 'ajax-wcpfrontend',
            // vars
            save_note  : 'true',
            lead_id    : leadID,
			note	   : note.getContent(),
            nextNonce  : WCP_Ajax.nextNonce,
			postID     : WCP_Ajax.postID
        }, function(response) {
			if (response.logged_in == 'false') {
                showLogInDiag(response.title, response.body, response.login_button, response.close);
                return false;
            }

			$('.wcp-modal').modal('hide');
			//alert(leadID);
			var noteContainer = '<div class="lead-note leadID-' + response.lead_id + ' noteID-' + response.note_id + '">'
                + '<i class="wcp-red wcp-md md-remove-circle-outline remove-note"> </i>'
				+ '<i class="wcp-md md-create edit-note"> </i>'
                + '<span class="timeline-header"><i class="wcp-dark md-history"></i> ' + response.date_added + '</span>'
            	+ '<span class="timeline-body">' + response.note + '</span>'
                + '</div>';
			$(noteContainer).prependTo('.lead-notes-container').effect("highlight", {color: WCP_Ajax.contactsColor}, 2000);
			$('.no-note').remove();
		});
	});

	// confirm remove note
	$(document).on('click', '.remove-note', function() {
		var leadID = $(this).closest('.lead-note').attr('class').split(' ')[1].split('-')[1];
		var noteID = $(this).closest('.lead-note').attr('class').split(' ')[2].split('-')[1];

        var modalBody = '';
        $.post(WCP_Ajax.ajaxurl, {
            // wp ajax action
            action: 'ajax-wcpfrontend',
            // vars
            remove_note: 'true',
			note_id    : noteID,
            lead_id    : leadID,
            nextNonce  : WCP_Ajax.nextNonce,
			postID     : WCP_Ajax.postID
        }, function(response) {

			if (response.logged_in == 'false') {
                showLogInDiag(response.title, response.body, response.login_button, response.close);
                return false;
            }

            modalBody += response.body;

            // add large class to modal (remove for smaller ones)
            $('.wcp-modal').find('.modal-dialog').addClass('modal-lg');

            $('.wcp-modal').find('.modal-title').html(response.title);
            $('.wcp-modal').find('.modal-body').html(modalBody);
            var footer = '<button type="button" class="btn btn-default" data-dismiss="modal">'
                        + response.cancel_button + '</button>'
                        + '<button type="button" class="btn btn-primary remove-this-note noteID-' + response.note_id + '">'
                        + response.confirm_button + '</button>';
            $('.wcp-modal').find('.modal-footer').html(footer);
            $('.wcp-modal').modal();
        });
        return false;
    });

	// remove note
	$(document).on('click', '.remove-this-note', function() {
		var noteID = $(this).attr('class').split(' ')[3].split('-')[1];
		var leadID = $(document).find('.lead-notes-container').attr('class').split(' ')[1].split('-')[1];
		$.post(WCP_Ajax.ajaxurl, {
            // wp ajax action
            action: 'ajax-wcpfrontend',
            // vars
            remove_this_note  : 'true',
            note_id    : noteID,
			lead_id    : leadID,
            nextNonce  : WCP_Ajax.nextNonce,
			postID     : WCP_Ajax.postID
        }, function(response) {
			if (response.logged_in == 'false') {
                showLogInDiag(response.title, response.body, response.login_button, response.close);
                return false;
            }

            $('.wcp-modal').modal('hide');
			$('.lead-note.noteID-' + response.note_id).remove();
        });
    });

	/* End Notes */

	/* Edit Individual Lead Page Fields */
    $(document).on('click', '.save-lead-fields', function() {
        var leadID = $(this).attr('class').split(' ')[1].split('-')[1];
        var fieldVals = {};
        $('.lead_field, .lead_select').each( function() {
            var name = $(this).attr('class').split(' ')[1];
            var value = $(this).val();
            fieldVals[name] = value;
        });

		// checkboxes
		$('.wcp-edit-lead .checkbox').each( function() {
			var name = $(this).attr('class').split(' ')[1];
			var value = ( $(this).is(':checked') ) ? 1 : 0;
			fieldVals[name] = value;
		});

        $.post(WCP_Ajax.ajaxurl, {
            // wp ajax action
            action: 'ajax-wcpfrontend',
            // vars
            save_lead_fields  : 'true',
            lead_id           : leadID,
            nextNonce         : WCP_Ajax.nextNonce,
			postID            : WCP_Ajax.postID,
            field_vals        : fieldVals,
        }, function(response) {
			if (response.logged_in == 'false') {
                showLogInDiag(response.title, response.body, response.login_button, response.close);
                return false;
			} else if (response.required == 'true') { // required input needed
                alert(response.required_msg);
                return false;
            }

			var updatedBy = response.field_vals.updated_by;
			var updatedDate = response.field_vals.updated_date_formatted;
			$(document).find('.updated_by').text(updatedBy);
			$(document).find('.updated_date').text(updatedDate);
			$('.save-lead-fields').addClass('saved').delay(5000).queue(function() {
                $('.save-lead-fields').removeClass('saved').dequeue();
            });
            //alert(response.message);
        });
        return false;
    });


	// Enable date picker
	$(document).ready(function() {
		$('.date-choice').datetimepicker({
			dateFormat : WCP_Ajax.dateFormat,
			timeFormat : WCP_Ajax.timeFormat,
			changeYear: true,
			yearRange: '-150:+50'
		});
	});
	// Enable date only picker
	$(document).ready(function() {
		$('.date-only-choice').datepicker({
			dateFormat: WCP_Ajax.dateFormat,
            changeYear: true,
            yearRange: '-150:+50'
		});
	});


	// set translations for datepicker and datetimepicker from our localized variables
	$.datepicker.regional['shwcp'] = WCP_Ajax.datepickerVars;
	$.timepicker.regional['shwcp'] = WCP_Ajax.timepickerVars;
	$.datepicker.setDefaults($.datepicker.regional['shwcp']);
	$.timepicker.setDefaults($.timepicker.regional['shwcp']);


	/* End Edit Individual Lead Page Fields */

	/* Import and Export Leads */

	// All or Range selection
	$(document).ready(function() {
		$('.allrows').attr('checked', true);
		$('.rowrange').attr('checked', false);
		$('.rowfilter').attr('checked', false);
		$('.range-select').hide();
		$('.filter-select').hide();
		$('.add-filter-row').hide();
	});
	$(document).on('click', '.rowrange', function() {
		$('.range-select').slideDown();
		$('.filter-select').slideUp();
		$('.add-filter-row').slideUp();
		$('.allrows').attr('checked', false);
		$('.rowfilter').attr('checked', false);
	});
	$(document).on('click', '.allrows', function() {
		$('.rowrange').attr('checked', false);
		$('.rowfilter').attr('checked', false);
		$('.filter-select').slideUp();
		$('.range-select').slideUp();
		$('.add-filter-row').slideUp();
	});
	$(document).on('click', '.rowfilter', function() {
		$('.rowrange').attr('checked', false);
		$('.allrows').attr('checked', false);
		$('.filter-select').slideDown();
		$('.add-filter-row').slideDown();
		$('.range-select').slideUp();
	});

	// Add export filter
	$(document).on('click', '.add-filter', function() {
		var filterVal = $(this).closest('.export-form').find('.filter-val:first').closest('.input-field').html();
		var filterSel = $(this).closest('.export-form').find('.filter-sel').html();
		var filterSelLabel = $(this).closest('.export-form').find("label[for='filter-sel']:first").text();
		var removeText = $(document).find('.remove-filter-text').text();
		var randomClass = 'select' + (new Date().getTime());
		var html = '<div class="row filter-select filter-entry"><div class="col-md-4"><div class="input-field">' 
				+ '<label for="filter-sel">' + filterSelLabel 
				+ '</label><select class="filter-sel input-select ' + randomClass + '" name="filter-sel[]">' 
				+ filterSel + '</select>'
				+ '</div></div><div class="col-md-4"><div class="input-field">' + filterVal + '</div></div>'
				+ '<div class="col-md-4"><a href="#" class="remove-filter">' + removeText + '</a></div></div>';
		$(html).insertAfter('.filter-entry:last').hide().slideDown();
		selectFieldGenerate(randomClass);
	});

	// Remove export filter
	$(document).on('click', '.remove-filter', function() {
		$(this).closest('.row').slideUp("normal", function() { $(this).remove(); });
		return false;
	});

	// Export Check All
	$(document).on('click', '.checkall', function() {
		$('.export-field').each( function() {
			if ($('.checkall').is(':checked')) {
				$(this).attr("checked", true);
			} else {
				$(this).attr("checked", false);
			}
		});
	});

	// Export validate at least 1 field selected
	$(document).on('click', '.submit-export', function() {
		var count_check = $(".export-field:checked").length;
		if (count_check == 0) {
			var modalBody = '';
        	$.post(WCP_Ajax.ajaxurl, {
            	// wp ajax action
            	action: 'ajax-wcpfrontend',
            	// vars
            	export_nofields: 'true',
            	nextNonce  : WCP_Ajax.nextNonce,
				postID     : WCP_Ajax.postID
        	}, function(response) {

            	modalBody += response.body;
            	// add large class to modal (remove for smaller ones)
            	$('.wcp-modal').find('.modal-dialog').addClass('modal-lg');

            	$('.wcp-modal').find('.modal-title').html(response.title);
            	$('.wcp-modal').find('.modal-body').html('<p class="modal-paragraph">' + modalBody + '</p>');
            	var footer = '<button type="button" class="btn btn-default" data-dismiss="modal">'
                        + response.cancel_button + '</button>';
            	$('.wcp-modal').find('.modal-footer').html(footer);
            	$('.wcp-modal').modal();
        	});
        	return false;
		} else {
			$('.export-form').submit();
		}
	});

	// MailChimp

	/* Form Ready To Send */
	$(document).on('click', '.confirm-mc-data', function() {
        var apiKey = $(document).find('.mc-api-key').val();
        var list = $('.mc-list-select option:selected').val();
        var emailField = $('.mc-email-select option:selected').val();
        var firstNameField = $('.mc-first-select option:selected').val();
        var lastNameField = $('.mc-last-select option:selected').val();
		if (apiKey) {
			$.post(WCP_Ajax.ajaxurl, {
                // wp ajax action
                action: 'ajax-wcpfrontend',
                // vars
                mail_chimp_conf : 'true',
                api_key         : apiKey,
                list            : list,
                email_field     : emailField,
                firstname_field : firstNameField,
                lastname_field  : lastNameField,
                nextNonce       : WCP_Ajax.nextNonce,
                postID          : WCP_Ajax.postID
            }, function(response) {
				var data = '<div class="mc-results">'
						 + '<div class="isa-success"><i class="md-star-rate"> </i>'
                         + response.status + '</div>'
				         + '<table class="mc-results">'
				var i=1;
				$.each(response.result, function(k,v) {
					var detail = v.detail;
					if (v.email_address) {   // subscribed users
						detail = v.email_address;
					}
					data += '<tr><td>' + i + '</td><td>' + detail + '</td><td>' + v.status + '</td></tr>';
				    i++;
				});
				data += '</table></div>';
				$('.mc-hammer').html(data);
				$('.confirm-mc-data').remove();
			});
			return false;
		}
	});
	
	/* Form Preparation */
	$(document).on('click', '.submit-mc-data', function() {
		var apiKey = $(document).find('.mc-api-key').val();
		var list = $('.mc-list-select option:selected').val();
		var emailField = $('.mc-email-select option:selected').val();
		var firstNameField = $('.mc-first-select option:selected').val();
		var lastNameField = $('.mc-last-select option:selected').val();
		if (!list) {
			list = 'notyet';
		}
		if (apiKey) {
			$.post(WCP_Ajax.ajaxurl, {
                // wp ajax action
                action: 'ajax-wcpfrontend',
                // vars
                mail_chimp      : 'true',
				api_key         : apiKey,
				list            : list,
				email_field     : emailField,
				firstname_field : firstNameField,
				lastname_field  : lastNameField,
                nextNonce       : WCP_Ajax.nextNonce,
                postID          : WCP_Ajax.postID
            }, function(response) {
				var fields = response.fields;
				var lists = response.lists;
				var container = '<div class="mc-hammer"></div>';
				var data = '';
				if (lists.status == '401') { // Error from MailChimp
                    data = '<div class="isa-error"><i class="md-warning"> </i>' 
					     + lists.detail + '</div>';

				} else if (fields) { // List and select columns (step 3)
					data = '<div class="input-field">'
                         + '<label for="mc-list-select">' + response.select_label + '</label>'
						 + '<select class="input-select mc-list-select">';
                    $.each(lists.lists, function(k,v) {
						var selected = '';
						if (v.id == response.selected_list) {
							selected = 'selected="selected"';
						}
                        data += '<option value="' + v.id + '" ' + selected + '>' + v.name + '</option>';
					});
					data += '</select></div>';

					data += '<div class="row"><div class="col-md-4"><div class="input-field">'
						 + '<label for="mc-email-select">' + response.email_label + '</label>'
					     + '<select class="input-select mc-email-select">'
						 + '<option value="">' + response.select_choose + '</option>';
					var emailField = response.email_field;
					$.each(fields, function(k,v) {
						var emailSelected = '';
						if (v.orig_name == emailField) {
							emailSelected = 'selected="selected"';
						}
						data +='<option value="' + v.orig_name + '" ' + emailSelected + '>' + v.translated_name + '</option>';
					});
					data += '</select></div></div>'
						  + '<div class="col-md-4"><div class="input-field">'
						  + '<label for="mc-first-select">' + response.firstname_label + '</label>'
						  + '<select class="input-select mc-first-select">'
						  + '<option value="">' + response.select_choose + '</option>';
					var firstNameField = response.firstname_field;
					$.each(fields, function(k,v) {
						var firstNameSelected = '';
						if (v.orig_name == firstNameField) {
							firstNameSelected = 'selected="selected"';
						}
                        data +='<option value="' + v.orig_name + '" ' + firstNameSelected + '>' + v.translated_name + '</option>';
                    });
					data += '</select></div></div>'
						  + '<div class="col-md-4"><div class="input-field">'
						  + '<label for="mc-last-select">' + response.lastname_label + '</label>'
						  + '<select class="input-select mc-last-select">'
						  + '<option value="">' + response.select_choose + '</option>';
					var lastNameField = response.lastname_field;
					$.each(fields, function(k,v) {
						var lastNameSelected = '';
						if (v.orig_name == lastNameField) {
							lastNameSelected = 'selected="selected"';
						}
                        data +='<option value="' + v.orig_name + '" ' + lastNameSelected + '>' + v.translated_name + '</option>';
                    });
					data += '</select></div></div></div>';

					if (response.confirm_ready && response.confirm_ready == 'true') { // confirmation before submit
						$('.submit-mc-data').text(response.confirm_submit)
							.removeClass('submit-mc-data').addClass('confirm-mc-data');
						data += '<div class="isa-success"><i class="md-star-rate"> </i>' 
							 + response.confirm + '</div>';
					}

				} else {  // Only the list to select (step 2)
					data = '<div class="input-field">'
						 + '<label for="mc-list-select">' + response.select_label 
						 + '</label><select class="input-select mc-list-select">';
					$.each(lists.lists, function(k,v) {
						data += '<option value="' + v.id + '">' + v.name + '</option>';
					});
					data += '</select></div>';
				}
				$(document).find('.sync-mc-div .mc-hammer').remove();
                $(document).find('.sync-mc-div').append(container);
                $('.mc-hammer').html(data)
				selectFieldGenerate();
				
            });
            return false;
		}

	});

	/* End Import and Export Leads */

	/* Statistics */

	// New Entries Chart
	/* Input Select items */
    $(document).ready(function() {
        newLeadStatsGenerate();
    });



    var newLeadStatsGenerate = function() {
        $('.lead-stats').each(function(){
            var $this = $(this), numberOfOptions = $(this).children('option').length;

            $this.addClass('lead-stats-hidden');
            $this.wrap('<div class="lead-stats"></div>');
            $this.after('<div class="lead-stats-styled"></div>');

            var $styledSelect = $this.next('div.lead-stats-styled');
            $styledSelect.text($this.children('option:selected').text());

            var $list = $('<ul />', {
                'class': 'lead-stats-options'
            }).insertAfter($styledSelect);

            for (var i = 0; i < numberOfOptions; i++) {
                $('<li />', {
                    text: $this.children('option').eq(i).text(),
                    rel: $this.children('option').eq(i).val()
                }).appendTo($list);
            }

            var $listItems = $list.children('li');

            $styledSelect.click(function(e) {
                e.stopPropagation();
                $('div.lead-stats-styled.active').each(function(){
                    $(this).removeClass('active').next('ul.lead-stats-options').fadeOut(300);
                });
                $(this).toggleClass('active').next('ul.lead-stats-options').fadeToggle(300);
                var currentVal = $(this).text();
                var inputSelect = $(this).closest('.lead-stats');
                inputSelect.find('li').each(function() {
                    var textVal=$(this).text();
                    if (textVal == currentVal) {
                        $(this).addClass('selected');
                    } else {
                        $(this).removeClass('selected');
                    }
                });
            });

            $listItems.click(function(e) {
                e.stopPropagation();
                $styledSelect.text($(this).text()).removeClass('active');
                $this.val($(this).attr('rel'));
                $list.fadeOut(300);
				var graph = $this.val();
				var ownleads = $(document).find('.ownleads-user').text();
				if (!ownleads) {
					ownleads = 'shwcp_admin_view';
				}
				// post value to update graph
				$.post(WCP_Ajax.ajaxurl, {
            		// wp ajax action
            		action: 'ajax-wcpfrontend',
            		// vars
            		graph: graph,
					ownleads: ownleads,
            		lead_stats: 'true',
            		nextNonce : WCP_Ajax.nextNonce,
					postID    : WCP_Ajax.postID

        		}, function(response) {
            		if (response.logged_in == 'false') {
                		showLogInDiag(response.title, response.body, response.login_button, response.close);
                		return false;
            		}
					// Total leads chart
					// Leads chart (line)
                    var data = {
                        labels: response.labels1,
                        datasets: [
                            {
                                label: "Monthly Leads",
                                fillColor: "rgba(151,187,205,0.2)",
                                strokeColor: "rgba(151,187,205,1)",
                                pointColor: "rgba(151,187,205,1)",
                                pointStrokeColor: "#fff",
                                pointHighlightFill: "#fff",
                                pointHighlightStroke: "rgba(151,187,205,1)",
                                data: response.values1
                            }
                        ]
                    };
					$('#monthlies').remove();
					$(document).find('.new-lead-view').closest('.chart-holder').append('<canvas id="monthlies"></canvas>');
                    var ctx = $("#monthlies").get(0).getContext("2d");
                    window.myNewChart = new Chart(ctx);
                    new Chart(ctx).Line(data, {
                       bezierCurve: true,
                       responsive: true
                    });
					
					// update graph
        		});
        		return false;
                //console.log($this.val());
            });


            $(document).click(function() {
                $styledSelect.removeClass('active');
                $list.fadeOut(300);
            });

        });
    };

	/* End Statistics */

	/* Logging Page */
	$(document).on('click', '.remove-all-logs', function() {
		var modalBody = '';
        $.post(WCP_Ajax.ajaxurl, {
            // wp ajax action
            action: 'ajax-wcpfrontend',
            // vars
            remove_logs  : 'true',
            nextNonce  : WCP_Ajax.nextNonce,
			postID     : WCP_Ajax.postID
        }, function(response) {
            if (response.logged_in == 'false') {
                showLogInDiag(response.title, response.body, response.login_button, response.close);
                return false;
            }

            modalBody += '<p class="modal-paragraph">' + response.body + '</p>';

            // add large class to modal (remove for smaller ones)
            $('.wcp-modal').find('.modal-dialog').addClass('modal-lg');

            $('.wcp-modal').find('.modal-title').html(response.title);
            $('.wcp-modal').find('.modal-body').html(modalBody);
            var footer = '<button type="button" class="btn btn-default" data-dismiss="modal">'
                        + response.cancel_button + '</button>'
                        + '<button type="button" class="btn btn-primary confirm-remove-logs">'
                        + response.confirm_button + '</button>';
            $('.wcp-modal').find('.modal-footer').html(footer);
            $('.wcp-modal').modal();
        });
        return false;
	});

	$(document).on('click', '.confirm-remove-logs', function() {
		$.post(WCP_Ajax.ajaxurl, {
            // wp ajax action
            action: 'ajax-wcpfrontend',
            // vars
            confirm_remove_logs  : 'true',
            nextNonce  : WCP_Ajax.nextNonce,
			postID     : WCP_Ajax.postID
        }, function(response) {
			// reload the page with logging empty
			location.reload(true);
		});
		return false;
	});

	/* Show dialog to login */
	function showLogInDiag(title, body, login_button, close) {
		var form = $(document).find('#login').prop("outerHTML");

        $('.wcp-modal').find('.modal-title').html(title);
        $('.wcp-modal').find('.modal-body').html(form);
        $('.modal-body').find('form').attr('id', 'login-displayed');
        var footer = '<button type="button" class="btn btn-primary login-button">'
                   + login_button + '</button>'
				   + '<button type="button" class="btn btn-default" data-dismiss="modal">'
                   + close + '</button>';
        $('.wcp-modal').find('.modal-footer').html(footer);
        $('.wcp-modal').modal();
	}

	/* Random String Generation */
	function randomString() {
		var result = (Math.random()*1e32).toString(36);
    	return result;
	}

	/* Popovers */
	$(document).on('click', '.field-options', function(e) {
		if ( e.target != this) { return; }
		var open = false;
		if ($(this).closest('.wcp-fielddiv').find('.popover-material').hasClass('is-open') ) {
			open = true;
		}
		$('.wcp-fielddiv').find('.popover-material').removeClass('is-open');
		$('.wcp-fielddiv').find('.field-options').removeClass('active');
		if (open) {
			$(this).closest('.wcp-fielddiv').find('.popover-material').removeClass('is-open');
			$('.wcp-fielddiv').find('.field-options').removeClass('active');
		} else {
			$(this).closest('.wcp-fielddiv').find('.popover-material').addClass('is-open');
			$(this).closest('.wcp-fielddiv').find('.field-options').addClass('active');
		}
	});

	// close popovers on outside clicks
	$(window).click(function(e) {
		if ($('.popover-material').length) {  // if it's on page
			if ( $(e.target).hasClass('field-options')
				|| $(e.target).closest('div').hasClass('popover-material') ) {
				// do nothing
			} else {
				$('.popover-material').removeClass('is-open');
				$('.wcp-fielddiv').find('.field-options').removeClass('active');
			}
		}
	});

    // Textarea Auto Resize (materialize.js)
    var hiddenDiv = $('.hiddendiv').first();
    if (!hiddenDiv.length) {
      hiddenDiv = $('<div class="hiddendiv common"></div>');
      $('body').append(hiddenDiv);
    }
    var text_area_selector = '.materialize-textarea';

    function textareaAutoResize($textarea) {
      // Set font properties of hiddenDiv

      var fontFamily = $textarea.css('font-family');
      var fontSize = $textarea.css('font-size');

      if (fontSize) { hiddenDiv.css('font-size', fontSize); }
      if (fontFamily) { hiddenDiv.css('font-family', fontFamily); }

      if ($textarea.attr('wrap') === "off") {
        hiddenDiv.css('overflow-wrap', "normal")
                 .css('white-space', "pre");
      }

      hiddenDiv.text($textarea.val() + '\n');
      var content = hiddenDiv.html().replace(/\n/g, '<br>');
      hiddenDiv.html(content);


      // When textarea is hidden, width goes crazy.
      // Approximate with half of window size

      if ($textarea.is(':visible')) {
        hiddenDiv.css('width', $textarea.width());
      }
      else {
        hiddenDiv.css('width', $(window).width()/2);
      }

      $textarea.css('height', hiddenDiv.height());
    }

    $(text_area_selector).each(function () {
      var $textarea = $(this);
      if ($textarea.val().length) {
        textareaAutoResize($textarea);
      }
    });

    $('body').on('keyup keydown autoresize', text_area_selector, function () {
      textareaAutoResize($(this));
    });

	// Fixed quick edit entries
	$(document).ready(function() {
		addFixedEdits();
	});

	$(window).on('resize', function(e) {
		var resizeTimer;
		clearTimeout(resizeTimer);
		resizeTimer = setTimeout(function() {
			addFixedEdits();
		}, 250);
	});

	/* Remove any existing and build new fixed-edits table if screen size is larger than 600
	 * Also create new id's for checkboxes
	 */
	function addFixedEdits() {
		if (WCP_Ajax.fixed_edit != 'true') {
			return;
		}
		$('.fixed-edits').remove();
		$('.wcp-table .edit-header, .wcp-table .edit-td').css('visibility', 'visible');
		if ($('.edit-header').length) {  // if it's the main page and edit is enabled
			if (window.innerWidth >= 600) {
				var tablePos = $('.wcp-table').offset();
				$('body').append($('<table class="fixed-edits"></table>'));
				$('.wcp-table th, .wcp-table td').each(function() {
					var row = $('<tr></tr>');
					if ($(this).hasClass('edit-header')) {
						var rowClass = $(this).closest('tr').attr('class');
						var rowHeight = $(this).closest('tr').height();
						$(this).clone().appendTo(row);
						row.addClass(rowClass);
						$('.fixed-edits').append(row);
						$('.fixed-edits .' + rowClass).css('height', rowHeight + 'px');

					} else if ($(this).hasClass('edit-td')) {
			    		var rowClass = $(this).closest('tr').attr('class');
						var rowHeight = $(this).closest('tr').height();
						var checkID = $(this).find('.delete-all').attr('id');
						var newCheckID = checkID + '-sticky';
						//alert(checkID);
						$(this).clone().appendTo(row);
						row.addClass(rowClass);
						$('.fixed-edits').append(row);
						$('.fixed-edits tr:last').css('height', rowHeight + 'px');
						$('.fixed-edits').find('#' + checkID).attr('id', newCheckID);
						$('.fixed-edits').find('label[for="' + checkID + '"]').attr('for', newCheckID);
					}
				});
				$('.fixed-edits').css('top', tablePos.top).css('right', tablePos.right);
				// hide but keep space for main table edit column
				$('.wcp-table .edit-header, .wcp-table .edit-td').css('visibility', 'hidden');
			} else {
				$('.wcp-table .edit-header, .wcp-table .edit-td').css('visibility', 'visible');
			}
		}

	};

	// End Fixed quick edit entries
	
	// Thumbnail regeneration routine
    $(document).on('click', '.regen-thumbnails', function() {
		var wait = $(document).find('.wcp-wait').text();
		var done = $(document).find('.wcp-done').text();
		$('.wcp-changetext').removeClass('regen-thumbnails').text(wait);
       	$.post(WCP_Ajax.ajaxurl, {
            // wp ajax action
            action: 'ajax-wcpfrontend',
            // vars
            thumbnail_regen  : 'true',
            nextNonce  : WCP_Ajax.nextNonce,
            postID     : WCP_Ajax.postID
        }, function(response) {
			$('.wcp-changetext').text(done);

        });
        return false;
	});

});
