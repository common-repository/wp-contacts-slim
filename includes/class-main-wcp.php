<?php
/**
  * WCP Main Class
  */

    class main_wcp {
        // properties
		protected $table_main;
		protected $table_sst;
		protected $table_log;
		protected $table_sort;
		protected $table_notes;
		protected $table_events;

		protected $field_noedit;   // non editable column
        protected $field_noremove; // non removable column list
		protected $colors;         // list of colors to rotate through for stats & calendar

		protected $allowedtags;    // allowed tags for notes with html (and anywhere else we need it)
		protected $current_user;
		protected $all_users;      // all wordpress users

		protected $curr_page;      // Current page
		protected $scheme;		   // http or https scheme

		protected $settings;
		protected $lead_count;     // total lead count
		protected $log_count;	   // total log count
		protected $first_tab;
		protected $second_tab;
		protected $frontend_settings;
		protected $can_access;
		protected $can_edit;
		protected $current_access;

		protected $shwcp_upload;
		protected $shwcp_upload_url; // upload folder url

		protected $shwcp_backup;     // backups directory
		protected $shwcp_backup_dir;

		protected $date_format = 'Y-m-d';  //Default Date and time formats
        protected $time_format = 'H:i:s';
		protected $date_format_js; // Formats for datepicker
		protected $time_format_js;

		protected $early_check = array();

        // methods
        public function __construct() {
			global $wpdb;

			// non removable fields
            $this->field_noremove = array(
                'id',
                'created_by',
                'updated_by',
                'creation_date',
                'updated_date',
				'owned_by',
				'lead_files'
            );
            // non editable fields
            $this->field_noedit = array(
                'id',
                'created_by',
                'updated_by',
                'creation_date',
                'updated_date',
				'small_image',
				'lead_files'
            );

			// Colors and highlights to rotate through
            $this->colors = array(
                1 => 'rgba(65,105,225,0.8)',
                2 => 'rgba(100,149,237,0.8)',
                3 => 'rgba(173, 216,230,0.8)',
                4 => 'rgba(240,230,140,0.8)',
                5 => 'rgba(189,183,107,0.8)',
                6 => 'rgba(143,188,143,0.8)',
                7 => 'rgba(60,179,113,0.8)',
                8 => 'rgba(255,165,0,0.8)',
                9 => 'rgba(205,92,92,0.8)',
                10 => 'rgba(160,82,45,0.8)',
                11 => 'rgba(244,67,54,0.8)',
                12 => 'rgba(255,205,210,0.8)',
                13 => 'rgba(231,67,99,0.8)',
                14 => 'rgba(207,59,96,0.8)',
                15 => 'rgba(149,117,205,0.8)',
                16 => 'rgba(126,87,194,0.8)',
                17 => 'rgba(102,187,106,0.8)',
                18 => 'rgba(67,160,71,0.8)',
                19 => 'rgba(97,97,97,0.8)',
                20 => 'rgba(66,66,66,0.8)'
            );

			$this->curr_page = isset($_GET['wcp']) ? sanitize_text_field($_GET['wcp']) : '';
			// scheme
			$this->scheme = is_ssl() ? 'https' : 'http'; // set proper protocol for admin-ajax.php calls

			// upload directory & url
			$upload_dir = wp_upload_dir();
            $this->shwcp_upload = $upload_dir['basedir'] . '/shwcp';
			$this->shwcp_upload_url = $upload_dir['baseurl'] . '/shwcp';

			// backup directory & url
			$this->shwcp_backup = $upload_dir['basedir'] . '/shwcp_backups';
			$this->shwcp_backup_url = $upload_dir['baseurl'] . '/shwcp_backups';
		}

		/**
		 * Title tag support wp4.4
		 */
		public function wcp_slug_setup() {
			add_theme_support( 'title-tag' );
		}

		/**
		 * Date & Time Format
		 * Called from load_db_options to get proper db
		 * @since 2.0.1
		 */
		public function dt_opt() {
			if (isset($this->first_tab['custom_time']) && $this->first_tab['custom_time'] == 'true') {
            	$date_format = get_option('date_format');
            	$time_format = get_option('time_format');
            	if ($date_format) {
                	$this->date_format = $date_format;
            	}
            	if ($time_format) {
                	$this->time_format = $time_format;
            	}
			}
            // Translate for datepicker
            $php_date_format = array('y', 'Y', 'F', 'm', 'd', 'j');
            $js_date_format = array('y', 'yy', 'MM', 'mm', 'dd', 'd'); // and so on
            $php_time_format = array('H', 'g', 'i', 'A', 'a');
            $js_time_format = array('HH', 'h', 'mm', 'TT', 'tt');
            $this->time_format_js = str_replace($php_time_format, $js_time_format, $this->time_format);
            $this->date_format_js = str_replace($php_date_format, $js_date_format, $this->date_format);

		}


		/**
		 * Dynamic DB and options loading
         */
		public function load_db_options($postID = '') {
			global $wpdb;
			if (!$postID) {
				$postID = $this->postid_early();
			}
			$db = '';
			$database = get_post_meta($postID, 'wcp_db_select', true);
			if ($database && $database != 'default') {
    			$db = '_' . $database;
			}

			$this->table_main     = $wpdb->prefix . SHWCP_LEADS  . $db;
            $this->table_sst      = $wpdb->prefix . SHWCP_SST    . $db;
            $this->table_log      = $wpdb->prefix . SHWCP_LOG    . $db;
            $this->table_sort     = $wpdb->prefix . SHWCP_SORT   . $db;
            $this->table_notes    = $wpdb->prefix . SHWCP_NOTES  . $db;
			$this->table_events   = $wpdb->prefix . SHWCP_EVENTS . $db;

			$this->first_tab         = get_option('shwcp_main_settings' . $db);
			$this->second_tab        = get_option('shwcp_permissions'  . $db);
			$this->frontend_settings = get_option('shwcp_frontend_settings' . $db);
			$this->dt_opt(); // Set the date formats
			// return $db for calls that need it
			return $db;
		}

		/**
		 * Early Check post id return
		 */
		public function postid_early() {
			if (is_ssl()) {
                $proto = 'https';
            } else {
                $proto = 'http';
            }
            $url = $proto . '://' . $_SERVER['HTTP_HOST'] . $_SERVER['REQUEST_URI'];
            $postid = url_to_postid($url);

            if (!$postid) { // check if this is the front page and get the id
                $url_without_query = strtok($url, '?'); // remove query string portion
                $url_without_query = rtrim($url_without_query, "/"); // remove trailing slash if present
                $site_url = get_site_url();
                if ($url_without_query == $site_url) {  // this is the front page
                    $postid = get_option( 'page_on_front' );
                }
            }
			return $postid;
		}

		/**
		 * Early Check if our template is used on this page
		 */
		public function template_early_check() {
			$template_used = false;
        	if (is_ssl()) {
            	$proto = 'https';
        	} else {
            	$proto = 'http';
        	}
        	$url = $proto . '://' . $_SERVER['HTTP_HOST'] . $_SERVER['REQUEST_URI'];
        	$postid = url_to_postid($url);

			if (!$postid) { // check if this is the front page and get the id
				$url_without_query = strtok($url, '?'); // remove query string portion
				$url_without_query = rtrim($url_without_query, "/"); // remove trailing slash if present
				$site_url = get_site_url();
				if ($url_without_query == $site_url) {  // this is the front page
					$postid = get_option( 'page_on_front' );
				}
			}

        	// look up if template is used
        	global $wpdb;
        	$template = $wpdb->get_var($wpdb->prepare(
            	"select meta_value from $wpdb->postmeta WHERE post_id='%d' and meta_key='_wp_page_template';", $postid
        	));
			if ($template == SHWCP_TEMPLATE) {
				$template_used = true;
			}
			$database = get_post_meta($postid, 'wcp_db_select', true);
			$this->early_check['postID'] = $postid;
			$this->early_check['template_used'] = $template_used;
			$this->early_check['database'] = $database;
			return $this->early_check;
    	}

		/**
		 * Get the current user info
		 *
		 */
		public function get_the_current_user() {
			$this->current_user = wp_get_current_user();

			// access and permissions
            // permissions are none, readonly, ownleads, full, notset
			// We now have custom roles as well
            $this->current_access = isset($this->second_tab['permission_settings'][$this->current_user->ID]) 
				? $this->second_tab['permission_settings'][$this->current_user->ID] : 'notset';
            $wcp_public = isset($this->first_tab['page_public']) ? $this->first_tab['page_public'] : 'false';
            $this->can_access = false;
			$this->can_edit = false;
            if ($wcp_public == 'true') {
                $this->can_access = true;
            } elseif ( is_user_logged_in() ) {
                if ( $this->current_access != 'none'
					&& $this->current_access != 'notset'
				) {
                    $this->can_access = true;
                }
            }

            if ($this->current_access == 'full' || $this->current_access == 'ownleads') {
                $this->can_edit = true;
            }
		}

		/**
		 * Get Custom roles info if it's set
		 * returns array access name or false and perms 
		 */
		public function get_custom_role() {
			$custom = array();
			$current_user = wp_get_current_user();
			$custom['access'] = isset($this->second_tab['permission_settings'][$this->current_user->ID])
			? $this->second_tab['permission_settings'][$this->current_user->ID] : false;
			if ($custom['access'] == 'none'
				|| $custom['access'] == 'readonly' 
				|| $custom['access'] == 'ownleads'
				|| $custom['access'] == 'full'
				|| $custom['access'] == 'notset'
			) {
				$custom['access'] = false;
			} else {
				$custom_roles = isset($this->second_tab['custom_roles']) ? $this->second_tab['custom_roles'] : array();
				foreach ($custom_roles as $k => $v) {
					if ($v['unique'] == $custom['access']) {
						$custom['perms']  = $custom_roles[$k];
					}
				}
			}
			return $custom;
		}

		/**
		 * Check for field override values set
		 * and see if the user role can access the individual field
		 * returns true for non-custom and custom with access, false for hidden or no access
		 */
		public function check_field_override($field_name) {
			$custom = $this->get_custom_role();
			//print_r($custom);
			if (!$custom['access']) {
				return true;  // can access the field
			} else {
				if ( (isset($custom['perms']['field_override']) && $custom['perms']['field_override'] == 'yes')
					 && (isset($custom['perms']['field_val'][$field_name]) && $custom['perms']['field_val'][$field_name] == 'hidden') 
				) {
					return false;
				} else {
					return true;
				}
			}
		}


		/**
		 * Get the lead count total
		 * called after current_user established to retain count for users
		 */
		public function get_lead_count() {
			// Total lead count
			global $wpdb;
            $ownleads = '';
            if ($this->current_access == 'ownleads') {
                $ownleads = 'WHERE owned_by=\'' . $this->current_user->user_login . '\'';
            }
            $this->lead_count = $wpdb->get_var( "SELECT COUNT(*) FROM $this->table_main $ownleads" );
			return $this->lead_count;
		}

		/**
		 * Get all WordPress users
		 */
		public function get_all_users() {
			$this->all_users =  get_users();
		}

		/**
		 * Get wcp users only
		 * compare with WP user list and get users with access
		 * @since 2.0.3
		 * @return array
		 */
		public function get_all_wcp_users() {
			$users = get_users();
			$wcp_users = $this->second_tab['permission_settings'];
			$all_wcp_users = array();
			foreach ($users as $user) {
				if (array_key_exists($user->ID, $wcp_users) && $wcp_users[$user->ID] != 'none') {
					$all_wcp_users[$user->ID] = $user;
				}
			}
			return $all_wcp_users;
		}

		/**
		 * Create image and file subdirectory
		 * @access public
		 * @since 1.0.0
		 * @return void
		*/
		public function shwcp_upload_directory() {
			if ( !file_exists($this->shwcp_upload) ) {
				wp_mkdir_p( $this->shwcp_upload );
			}
		}

		/**
		 * Get a list of current databases
		 * @ since 3.2.1
		 * @return array
		 */
        public function wcp_getdbs($location='') {
			$format = false;
			if ($location == 'gutenberg') {
				// This is from gutenberg and we need to format results for that
				$format = true;
			}
            global $wpdb;
			global $post;
            $options_table = $wpdb->prefix . 'options';
            $option_entry = 'shwcp_main_settings';
            $dbs = $wpdb->get_results("SELECT * FROM $options_table WHERE `option_name` LIKE '%$option_entry%'");

			// possible return items
            $databases = array();
			$gutenberg = array();
			if ($format) {
				$gutenberg['databases'][] = ['value' => null, 'label' => __('Select a Database', 'shwcp'), 'disabled' => true];
				$selected = get_post_meta( $post->ID, 'wcp_db_select', true);
				if (!$selected) {
                	$selected = 'default';
            	}
				$gutenberg['selected'] = $selected;
			}
            
			foreach ($dbs as $k => $option) {
                if ($option->option_name == $option_entry) {
                    $db_options = get_option($option->option_name);
                    if (!isset($db_options['database_name'])) {
                        $database_name = __('Default', 'shwcp');
                    } else {
                        $database_name = $db_options['database_name'];
                    }
					if ($format) {
						$gutenberg['databases'][] = ['value'=> 'default', 'label'=> $database_name];
						//$gutenberg .= "{value: 'default', label: '$database_name'},\n";
					} else {
                    	$databases['default'] = $database_name;
					}
                } else {
                    $db_options = get_option($option->option_name);
                    $remove_name = '/^' . $option_entry . '_/';  // Just get the database number
                    $db_number = preg_replace($remove_name, '', $option->option_name);
                    $database_name = $db_options['database_name'];

					if ($format) {
						$gutenberg['databases'][] = ['value' => $db_number, 'label' => $database_name];
						//$gutenberg .= "{value: '$db_number', label: '$database_name'},\n";
					} else {
                    	$databases[$db_number] = $database_name;
					}
                }
            }
            //print_r($databases);
			if ($format) {
				return $gutenberg;
			} else {
            	return $databases;
			}
        }	

		/**
		 * Delete all tables and files associated with a shwcp database
		 * @ since 3.2.3
		 * @ return integer
		 */
		public function wcp_deldb ($dbnumber) {
			global $wp_filesystem;
			if ($dbnumber == 'default') {
				$dbnumber = '';
			} else {
				$dbnumber = '_' . $dbnumber;
			}
			 // delete tables
                require_once SHWCP_ROOT_PATH . '/includes/class-setup-wcp.php';
                $setup_wcp = new setup_wcp;
                $setup_wcp->drop_tables($dbnumber);
                // delete options - match settings api names and database number
                $first_tab_key           = 'shwcp_main_settings'     . $dbnumber;
                $permission_settings_key = 'shwcp_permissions'       . $dbnumber;
				$frontend_settings       = 'shwcp_frontend_settings' . $dbnumber;
                delete_option($first_tab_key);
                delete_option($permission_settings_key);
                delete_option($frontend_settings);

                // Delete File Directory
                $file_loc = $this->shwcp_upload . $dbnumber;
                if (file_exists($file_loc) ) {
                    $wp_filesystem->rmdir($file_loc, true);  // true for recursive
                }
			return $dbnumber;
		}

		/**
		 * Next available database number used for create and clone
		 * @ since 3.2.7
		 * return integer
		 */
		public function wcp_next_db() {
			global $wpdb;
			// loop through existing leads table to find the next available number to assign the db to 
            $databases = array();
			$table_main = $wpdb->prefix . SHWCP_LEADS;
            $dbs = $wpdb->get_results("SHOW tables LIKE '$table_main%'");
            foreach ($dbs as $k => $v) {
            	foreach ($v as $v2 => $table) {
                	if ($table == $table_main) {  // default database, ignore...
                    	// ignore
                    } else {        // All others created, find numeric values after name
                    	$databases[] = $table;
                    }
                }
            }
            $db_inc = 1;
            $dbname = $table_main . '_' . $db_inc;
            while(in_array($dbname, $databases)) {
            	$db_inc++;
            	$dbname = $table_main . '_' . $db_inc;
            }
            $dbnumber = '_' . $db_inc;	
			return ($dbnumber);
		}

		/**
		 *  Strip slashes on array function
		 * @ since 3.2.5
		 * @ return string
		 */
		public function stripslashes_deep($value) {
    		$value = is_array($value) ?
            array_map('stripslashes_deep', $value) :
            stripslashes($value);

    		return $value;
		}

		/**
		 * Sanitize multidimensional array
		 * @ since 1.0.0
		 * @return array
		 */
		public function sanitize_array( &$array ) {
			foreach ($array as &$value) {	
				if( !is_array($value) )	{
					// sanitize if value is not an array
					$value = sanitize_text_field( $value );
				} else {
					// go inside this function again
					$this->sanitize_array($value);
				}
				return $array;
			}
		}

		/*
		 * Check editor and load either Gutenberg or Classic files and scripts
         * @ since 1.0.0
		 */
		public function shwcp_editor_check() {
            $gutenberg_active = $this->shwcp_gutenberg_active();
            if ($gutenberg_active) {
                /* Gutenberg Envieonment */
                //require_once SHWCP_ROOT_PATH . '/shwcp-gutenberg/plugin.php';
                require_once SHWCP_ROOT_PATH . '/includes/class-wcp-gutenberg.php';

            } else {
                // Page metabox for db selection (classic editor)
                if (is_admin()) {
                    require_once SHWCP_ROOT_PATH . '/includes/class-wcp-metabox.php';
                    $wcp_metabox = new wcp_metabox;
                    $wcp_metabox->gen_metaboxes();
                }
            }
        }

        /*
         * Check if gutenberg is active
         */
        public function shwcp_gutenberg_active() {
            $gutenberg    = false;
            $block_editor = false;
            if ( has_filter( 'replace_editor', 'gutenberg_init' ) ) {
                // Gutenberg is installed and activated.
                $gutenberg = true;
            }
            if ( version_compare( $GLOBALS['wp_version'], '5.0-beta', '>' ) ) {
                // Block editor.
                $block_editor = true;
            }
            if ( ! $gutenberg && ! $block_editor ) {
                return false;
            }
            include_once ABSPATH . 'wp-admin/includes/plugin.php';

            if ( ! is_plugin_active( 'classic-editor/classic-editor.php' ) ) {
                return true;
            }
            $use_block_editor = ( get_option( 'classic-editor-replace' ) === 'no-replace' );
            return $use_block_editor;
        }


	} // end class
