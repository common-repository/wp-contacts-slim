<?php
/*
 * The main plugin class, holds everything our plugin does,
 * initialized right after declaration
 */
class SHWCP_API_Tabs {
	
	/*
	 * For easier overriding we declared the keys
	 * here as well as our tabs array which is populated
	 * when registering settings
	 */
	private $first_tab_key           = 'shwcp_main_settings';
	private $permission_settings_key = 'shwcp_permissions';
	private $info_settings_key       = 'shwcp_info';
	private $db_actions_key          = 'shwcp_db';

	private $first_tab_key_db;
	private $permission_settings_key_db;
	private $info_settings_key_db;
	private $db_actions_key_db;
	private $db;

	protected $table_sst;
    protected $table_log;
    protected $table_sort;
    protected $table_notes;

	private $plugin_options_key = 'shwcp_options';
	private $plugin_settings_tabs = array();

	private $shwcp_backup;
	private $shwcp_backup_url;
	private $backup_files;

	private $show_contact_upload = false;

	/*
	 * Fired during plugins_loaded (very very early),
	 * so don't miss-use this, only actions and filters,
	 * current ones speak for themselves.
	 */
	function __construct() {
		// options are dynamic and naming matches table names when using multiple databases
		$db = '';
		if (isset($_GET['db'])) {  // Initial link
    		$db_var = isset($_GET['db']) ? intval($_GET['db']) : 0;
    		if ($db_var > 0) {
        		$db = '_' . $db_var;
    		} else {
        		$db = ''; // for default
    		}
		} elseif (isset($_GET['tab'])) {  // Tab Navigation
			if (preg_match('/^' . $this->first_tab_key . '(\S+)/', $_GET['tab'], $matches)) {
				$db = $matches[1];
			} elseif (preg_match('/^' . $this->permission_settings_key . '(\S+)/', $_GET['tab'], $matches)) {
				$db = $matches[1];
			} elseif (preg_match('/^' . $this->info_settings_key . '(\S+)/', $_GET['tab'], $matches)) {
				$db = $matches[1];
			} elseif (preg_match('/^' . $this->db_actions_key . '(\S+)/', $_GET['tab'], $matches)) {
				$db = $matches[1];
			}
		} elseif (isset($_POST['option_page'])) {  // On Save post 
            if (preg_match('/^' . $this->first_tab_key . '(\S+)/', $_POST['option_page'], $matches)) {
                $db = $matches[1];
            } elseif (preg_match('/^' . $this->permission_settings_key . '(\S+)/', $_POST['option_page'], $matches)) {
                $db = $matches[1];
            } elseif (preg_match('/^' . $this->info_settings_key . '(\S+)/', $_POST['option_page'], $matches)) {
                $db = $matches[1];
            } elseif (preg_match('/^' . $this->db_actions_key . '(\S+)/', $_POST['option_page'], $matches)) {
                $db = $matches[1];
            }
		}
		//echo '<p>DB is ' . $db . '</p>';
		$this->db = $db;  // set private variable for other methods to access

		// override options with specific database if set
		$this->first_tab_key_db            = $this->first_tab_key . $db;
		$this->permission_settings_key_db  = $this->permission_settings_key . $db;
		$this->info_settings_key_db        = $this->info_settings_key . $db;
		$this->db_actions_key_db           = $this->db_actions_key . $db;

		global $wpdb;
        $this->table_main     = $wpdb->prefix . SHWCP_LEADS . $db;
        $this->table_sst      = $wpdb->prefix . SHWCP_SST . $db;
        $this->table_log      = $wpdb->prefix . SHWCP_LOG . $db;
        $this->table_sort     = $wpdb->prefix . SHWCP_SORT . $db;
        $this->table_notes    = $wpdb->prefix . SHWCP_NOTES . $db;

		add_action( 'init', array( &$this, 'load_settings' ) );
		add_action( 'admin_init', array( &$this, 'register_first_tab' ) );
		add_action( 'admin_init', array( &$this, 'register_second_tab' ) );
		add_action( 'admin_init', array( &$this, 'register_db_tab' ) );
		add_action( 'admin_init', array( &$this, 'register_info_tab' ) );
		add_action( 'admin_menu', array( &$this, 'add_admin_menus' ) );
		// submenus
		add_action('admin_menu', array(&$this, 'add_admin_submenus' ) );

        // Callback Ajax Backend ajax
        require_once(SHWCP_ROOT_PATH . '/includes/class-wcp-ajax.php');
        $wcp_ajax = new wcp_ajax();
        add_action( 'wp_ajax_ajax-wcpbackend', array($wcp_ajax, 'myajax_wcpbackend_callback'));

		// admin post for downloading backups
        require_once(SHWCP_ROOT_PATH . '/includes/class-wcp-dlbackups.php');
        $wcp_dl_backups = new wcp_dl_backups();
        add_action( 'admin_post_wcpdlbackups', array($wcp_dl_backups, 'dlbackups_callback'));

		// get folder info in backup directory - repeat of main class for now since this class doesn't extend
        $upload_dir = wp_upload_dir();
        // backup directory & url
        $this->shwcp_backup = $upload_dir['basedir'] . '/shwcp_backups';
        $this->shwcp_backup_url = $upload_dir['baseurl'] . '/shwcp_backups';
		if ( !file_exists($this->shwcp_backup) ) {
            wp_mkdir_p( $this->shwcp_backup );
        }
		// list of backups
		require_once ABSPATH . '/wp-includes/ms-functions.php'; // needed for get_dirsize function
		if (!$db) { // default dabatabase (new name is 'default', old was contacts so grab either)
			$this->backup_files = preg_grep('/^(contacts\S+)|(default\S+)/', scandir($this->shwcp_backup));
		} else {
        	$this->backup_files = preg_grep('/^database' . $db . '([^.])/', scandir($this->shwcp_backup));
		}
	}
	
	/*
	 * Loads both the general and advanced settings from
	 * the database into their respective arrays. Uses
	 * array_merge to merge with default values if they're
	 * missing.
	 */
	function load_settings() {
		$this->first_tab = (array) get_option( $this->first_tab_key_db );
		$this->permission_settings = (array) get_option( $this->permission_settings_key_db );
		$this->info_settings = (array) get_option( $this->info_settings_key_db );
		$this->db_actions = (array) get_option( $this->db_actions_key_db );
		
		// Merge with defaults
		$this->first_tab = array_merge( array(
			'page_option' => 'Some Page',
			'database_name' => 'Default',
			'page_public' => 'false',
			'troubleshoot' => 'false',   // enable scripts in header vs footer
			'fixed_edit' => 'false',
			'all_fields' => 'false',
			'custom_time' => 'false',
			'custom_links' => '',
			'custom_css' => '',
			'custom_js' => '',
			'page_page' => 'true',
			'page_page_count' => '40',
			'default_sort' => 'id',
			'default_sort_dir' => 'desc',
			'show_admin' => 'true',
			'page_color' => '#607d8b',
			'logo_attachment_url' => SHWCP_ROOT_URL . '/assets/img/wpcontacts.png',
			'logo_attachment_id' => '',
			'page_footer' => 'WP Contacts &copy;2020 ScriptHat',
			'page_greeting' => 'Welcome To <span class="wcp-primary">WP</span> Contacts',
			'contact_image' => 'true', 
			'contact_image_url' => '',
			'contact_image_thumbsize' => '20',
			'contact_image_id' => '',
			'contact_upload' => 'true',
			'export_file' => 'WP-Contacts-Export',
		), $this->first_tab );

		// set current user default to full permissions
		$current_user = get_current_user_id();
		$this->permission_settings = array_merge( array(
			'advanced_option'        => 'Advanced value',
			'own_leads_change_owner' => 'yes',
			'permission_settings'    => array (
				"$current_user" => 'full'
			),
			'system_access' => array (
				"$current_user" => 1
			),
			'custom_roles'           => array ()
		), $this->permission_settings );

		$this->info_settings = array_merge( array(
			'nothing_yet' => 'nothing'
		), $this->info_settings );

		$this->db_actions = array_merge( array(
			'reset_db' => 'false',
			'backup_db' => 'false',
			'restore_db' => 'false',
			'backups_list' => 'false'

		), $this->db_actions );

		// Generate thumbnail if contact_image_url and id set but no thumbnail exists yet
		if ($this->first_tab['contact_image_url'] != ''
			&& $this->first_tab['contact_image_id'] !='' ) {
			$image_id = intval($this->first_tab['contact_image_id']);

			$image_meta = wp_get_attachment_metadata($image_id);
			if (!empty($image_meta)) {  // make sure it's in the db
				$full_file = $image_meta['file'];
				$file_fullname = basename( $full_file );

				$info = pathinfo($file_fullname);
				$file_name = basename($file_fullname,'.'. $info['extension']);
				$file_ext = $info['extension'];
				$small_image = $file_name . '_25x25' . '.' . $file_ext;
				
				// check for existing thumb
				$upload_dir = wp_upload_dir();
				$shwcp_upload = $upload_dir['basedir'] . '/shwcp' . $this->db;
				if (!file_exists($shwcp_upload . '/' . $small_image)) {
					$new_thumb = $shwcp_upload . '/' . $small_image;
					$full_file_path = $upload_dir['basedir'] . '/' . $full_file;
					$thumb = wp_get_image_editor( $full_file_path );
                    if ( !is_wp_error($thumb) ) {
						$size = intval($this->first_tab['contact_image_thumbsize']);
                        $thumb->resize($size, $size, true);
                        $thumb->save( $new_thumb );
                    }
				}
			}
		}
	}
	
	/*
	 * Registers the main settings via the Settings API,
	 * appends the setting to the tabs array of the object.
	 */
	function register_first_tab() {
		$this->plugin_settings_tabs[$this->first_tab_key_db] = __('Main Settings', 'shwcp');
		
		register_setting( $this->first_tab_key_db, $this->first_tab_key_db );
		add_settings_section( 'section_general', __('Main Contacts Settings', 'shwcp'), array( &$this, 'section_general_desc' ), 
				$this->first_tab_key_db );
		add_settings_field( 'page_option', __('Page for WP Contacts', 'shwcp'), array( &$this, 'field_page_option' ), 
				$this->first_tab_key_db, 'section_general' );
		add_settings_field( 'database_name', __('Database Name', 'shwcp'), array( &$this, 'field_database_name' ),
				$this->first_tab_key_db, 'section_general' );

		add_settings_field( 'page_public', __('Public Accessibility', 'shwcp'), array( &$this, 'field_page_public' ),
				$this->first_tab_key_db, 'section_general' );

		add_settings_field( 'page_page', __('Use Pagination', 'shwcp'), array( &$this, 'field_page_page' ),
                $this->first_tab_key_db, 'section_general' );
		add_settings_field( 'page_page_count', __('Pagination Results', 'shwcp'), array( &$this, 'field_page_page_count' ),
                $this->first_tab_key_db, 'section_general' );
		add_settings_field( 'default_sort', __('Default Front Sort', 'shwcp'), array( &$this, 'field_default_sort' ),
				$this->first_tab_key_db, 'section_general' );
		add_settings_field( 'show_admin', __('Show WP Admin Bar', 'shwcp'), array( &$this, 'field_show_admin' ),
				$this->first_tab_key_db, 'section_general' );
		add_settings_field( 'page_color', __('Primary Color', 'shwcp'), array( &$this, 'field_color_option' ), 
				$this->first_tab_key_db, 'section_general' );
		add_settings_field( 'logo_attachment_url', __('Logo Image', 'shwcp'), array( &$this, 'field_logo_image' ),
                $this->first_tab_key_db, 'section_general' );
		add_settings_field( 'page_footer', __('Footer Text', 'shwcp'), array( &$this, 'field_footer_option' ), 
				$this->first_tab_key_db, 'section_general' );
		add_settings_field( 'page_greeting', __('Greeting Text', 'shwcp'), array( &$this, 'field_greeting_option' ),
		        $this->first_tab_key_db, 'section_general' );
		add_settings_field( 'export_file', __('Export File Name', 'shwcp'), array( &$this, 'field_export_file' ),
				$this->first_tab_key_db, 'section_general' );
		add_settings_field( 'contact_image', __('Entry Image', 'shwcp'), array( &$this, 'field_contact_image' ),
				$this->first_tab_key_db, 'section_general' );
		add_settings_field( 'contact_image_url', __('Default Entry Image', 'shwcp'), 
				array( &$this, 'field_default_image_url' ), $this->first_tab_key_db, 'section_general' );
		add_settings_field( 'contact_image_thumbsize', __('Front Page Thumbnail Size', 'shwcp'),
                array( &$this, 'field_contact_thumbsize' ), $this->first_tab_key_db, 'section_general' );


		add_settings_field( 'contact_upload', __('Contact Uploads', 'shwcp'), array( &$this, 'field_contact_upload' ),
				$this->first_tab_key_db, 'section_general' );

		add_settings_field( 'fixed_edit', __('Fixed Edit Column', 'shwcp'), array( &$this, 'field_fixed_edit' ),
                $this->first_tab_key_db, 'section_general' );

		add_settings_field( 'all_fields', __('Search All Fields', 'shwcp'), array( &$this, 'field_all_fields' ),
				$this->first_tab_key_db, 'section_general' );

		add_settings_field( 'custom_time', __('Use WordPress Date & Time Settings', 'shwcp'), array( &$this, 'field_custom_time' ),
				$this->first_tab_key_db, 'section_general' );

		add_settings_field( 'custom_links', __('Custom Menu Links', 'shwcp'), array( &$this, 'field_custom_links' ),
				$this->first_tab_key_db, 'section_general' );

		add_settings_field( 'custom_css', __('Custom CSS', 'shwcp'), array( &$this, 'field_custom_css' ),
				$this->first_tab_key_db, 'section_general' );

		add_settings_field( 'custom_js', __('Custom Javascript', 'shwcp'), array( &$this, 'field_custom_js' ),
                $this->first_tab_key_db, 'section_general' );

		if ($this->first_tab_key == $this->first_tab_key_db) { // only needed on initial settings
            add_settings_field( 'troubleshoot', __('Troubleshooting', 'shwcp'), array( &$this, 'field_troubleshoot' ),
                $this->first_tab_key_db, 'section_general' );
        }
	}
	
	/*
	 * Registers the permission settings and appends the
	 * key to the plugin settings tabs array.
	 */
	function register_second_tab() {
		$this->plugin_settings_tabs[$this->permission_settings_key_db] = __('Permissions', 'shwcp');
		
		register_setting( $this->permission_settings_key_db, $this->permission_settings_key_db );
		add_settings_section( 'section_permission', __('Set Users Access to WP Contacts Slim', 'shwcp'), array( &$this, 'section_permission_desc' ), $this->permission_settings_key_db );
		add_settings_field( 'manage_own_owner', __('Manage Own Entries Ownership Change', 'shwcp'), array( &$this, 'field_manage_own_owner' ), $this->permission_settings_key_db, 'section_permission' );

		add_settings_field( 'user_permission', __('Users', 'shwcp'), array( &$this, 'field_user_permission' ), $this->permission_settings_key_db, 'section_permission' );

		add_settings_field( 'custom_roles', __('Custom Access Roles', 'shwcp'), array( &$this, 'field_custom_roles' ), $this->permission_settings_key_db, 'section_permission' );
	}

	/*
	 * Register info tab info
	 *
	 */
	function register_info_tab() {
		$this->plugin_settings_tabs[$this->info_settings_key_db] = __('Site Information', 'shwcp');
		$banner_img = "<img src='" . SHWCP_ROOT_URL . '/assets/img/wpcontacts590x300-2.jpg' . "' /><br /><br />";

		register_setting( $this->info_settings_key_db, $this->info_settings_key_db );
		add_settings_section( 'section_info', $banner_img . __('Information', 'shwcp'), array( &$this, 'section_site_desc' ), 
				$this->info_settings_key_db);
		add_settings_field( 'site_info', __('Server Info', 'shwcp'), array( &$this, 'field_section_info'), 
				$this->info_settings_key_db, 'section_info' );
	}

	/*
	 * Register db tab info
	 *
	 */
	function register_db_tab() {
		$this->plugin_settings_tabs[$this->db_actions_key_db] = __('Database Operations', 'shwcp');

        register_setting( $this->db_actions_key_db, $this->db_actions_key_db );
        add_settings_section( 'db_actions', __('Database Actions Available', 'shwcp'), array( &$this, 'section_db_desc' ),
                $this->db_actions_key_db);
		add_settings_field( 'backup_db', __('Backup Database', 'shwcp'), array( &$this, 'field_backup_db'),
                $this->db_actions_key_db, 'db_actions' );
		add_settings_field( 'restore_db', __('Restore Database Backup', 'shwcp'), array( &$this, 'field_restore_db'),
                $this->db_actions_key_db, 'db_actions' );
		add_settings_field( 'backups_list', __('Current Backups', 'shwcp'), array( &$this, 'field_backups_list'),
                $this->db_actions_key_db, 'db_actions' );
        add_settings_field( 'reset_db', __('Reset Database', 'shwcp'), array( &$this, 'field_reset_db'),
                $this->db_actions_key_db, 'db_actions' );
    }
	
	/*
	 * The following methods provide descriptions
	 * for their respective sections, used as callbacks
	 * with add_settings_section
	 */
	function section_general_desc() { echo __('Set up WP Contacts general settings on this tab.', 'shwcp'); }
	function section_permission_desc() { echo __('Set up WP Contacts Users and access to the frontend.  You will have Full Access by default. Keep in mind if you have public accessible set to true in the Main Settings, all logged in users will also be able to view entries.', 'shwcp'); }
	function section_site_desc() { echo __('Note that these server settings will affect the size, amount, and time taken allowed for uploads and scripts.  Be aware of this as it will affect the size of uploads and time allowed for processing imports etc.  <br />These PHP settings may need to be adjusted on your server according to your requirements.', 'shwcp');
	echo '<ul><li><u>' . __('You are running version', 'shwcp') . ' <span class="shwcp-version">' . SHWCP_PLUGIN_VERSION . '</span> ' . __('of WP Contacts Slim', 'shwcp') . '</u> ' . __('Created by', 'shwcp') . ' <a href="https://www.scripthat.com" target="_blank">ScriptHat</a></li><li>' . __('Have a question? Take a look at our', 'shwcp') . ' <a href="https://www.scripthat.com/support/" target="_blank">' . __('Online Documentation', 'shwcp') . '</a></li>';

	echo '<li>' . __('This is our ', 'shwcp') . '<b>' . __('slim (free) version of WP Contacts', 'shwcp') . '</b>' . __(', the full version has many more features.  Take a look at our ', 'shwcp') . ' <a href="https://www.scripthat.com/wpcontacts-feature-compare/" target=_blank">' . __('Feature Comparison Table!', 'shwcp') . '</a></li></ul>';

	}
	function section_db_desc() { echo __('This section allows you to perform various actions on your database.  Pay attention to what you are doing as changes here will affect what you have in your database!', 'shwcp'); }
	
	/*
	 * Main Settings field callback, WP Contacts Page
	 */
	function field_page_option() {
		?>
		<p>
		<?php echo __("If you haven't done so, create a blank page for WP Contacts and assign the WP Contacts Template to it first.", 'shwcp'); ?>
		</p>
		<?php
	}

	/*
	 * Field Database Name - used to associate a name to the database to use when the page template is selected
	 * @since 2.0.0
	 */
	function field_database_name() {
		?>
		<input class="database-name" name="<?php echo $this->first_tab_key_db; ?>[database_name]" 
            value="<?php echo esc_attr( $this->first_tab['database_name'] ); ?>" />
        <p><?php echo __("The name used to associate the WP Contacts page template with a specific database.  If you have multiple databases, you'll be able to select this on a page that is using the WP Contacts template.  This is also used in our api and our Zapier extension.", 'shwcp'); ?></p>
        <?php
    }


	/*
	 * Main Settings field callback, front page accessibility
	 */
	function field_page_public() {
		?>
		<select class="wcp-public" name="<?php echo $this->first_tab_key_db; ?>[page_public]">
			<option value="false" <?php selected( $this->first_tab['page_public'], 'false'); ?>
			><?php echo __('False', 'shwcp'); ?></option>
			<option value="true" <?php selected( $this->first_tab['page_public'], 'true'); ?>
			><?php echo __('True', 'shwcp'); ?></option>
		</select>
		<p>
			<?php echo __("Choose if you want to allow people who are not logged in read access to WP Contacts", "shwcp");?>
		</p>
		<?php
	}

	/*
	 * Troubleshooting - enable scripts in header to avoid conflicts
	 */
	function field_troubleshoot() {
		 ?>
        <select class="wcp-troubleshoot" name="<?php echo $this->first_tab_key_db; ?>[troubleshoot]">
            <option value="false" <?php selected( $this->first_tab['troubleshoot'], 'false'); ?>
            ><?php echo __('False', 'shwcp'); ?></option>
            <option value="true" <?php selected( $this->first_tab['troubleshoot'], 'true'); ?>
            ><?php echo __('True', 'shwcp'); ?></option>
        </select>
        <p>
            <?php echo __("Move scripts to header - only necessary if you are having javascript conflicts with a theme or other plugins. Symptoms would be frontend functionality is not working correctly.  Use as a last resort as the cause of the problem should be located and corrected.", "shwcp");?>
        </p>
        <?php
    }

	/* 
	 * Fixed Edit Columns
	 */
	function field_fixed_edit() {
		?>
		<select class="wcp-fixed-edit" name="<?php echo $this->first_tab_key_db; ?>[fixed_edit]">
            <option value="false" <?php selected( $this->first_tab['fixed_edit'], 'false'); ?>
            ><?php echo __('False', 'shwcp'); ?></option>
            <option value="true" <?php selected( $this->first_tab['fixed_edit'], 'true'); ?>
            ><?php echo __('True', 'shwcp'); ?></option>
        </select>
        <p>
            <?php echo __("Choose to enable a sticky edit column on the main view (Edit column stays visable).  Good for large frontend table views.", "shwcp");?>
        </p>
        <?php
    }

	/*
	 * Search All Fields Option
	 */
	function field_all_fields() {
		?>
        <select class="wcp-fixed-edit" name="<?php echo $this->first_tab_key_db; ?>[all_fields]">
            <option value="false" <?php selected( $this->first_tab['all_fields'], 'false'); ?>
            ><?php echo __('False', 'shwcp'); ?></option>
            <option value="true" <?php selected( $this->first_tab['all_fields'], 'true'); ?>
            ><?php echo __('True', 'shwcp'); ?></option>
        </select>
        <p>
            <?php echo __("Choose to enable option to search all fields at once in search.  Warning, depending on your server capabilities and how many columns you have these have the potential to be slow.  It's always better to search specific fields.", "shwcp");?>
        </p>
        <?php
    }

	/*
	 * Use WordPress Custom Time format for date and time fields
	 */
	function field_custom_time() {
		?>
         <select class="wcp-custom-time" name="<?php echo $this->first_tab_key_db; ?>[custom_time]">
            <option value="false" <?php selected( $this->first_tab['custom_time'], 'false'); ?>
            ><?php echo __('False', 'shwcp'); ?></option>
            <option value="true" <?php selected( $this->first_tab['custom_time'], 'true'); ?>
            ><?php echo __('True', 'shwcp'); ?></option>
        </select>
        <p>
            <?php echo __("You can set WP Contacts to use the WordPress custom time settings under Settings -> General.  Keep in mind searching for partial dates will be the most flexible with this disabled.  ", "shwcp");
?>
        </p>
        <?php
    }

	/*
	 * Custom Menu Links
	 */
	function field_custom_links() {
		$link_text     = __('Link Text', 'shwcp');
		$link_url_text = __('Link URL (e.g. http://www.example.com)', 'shwcp');
		$delete_text   = __('Delete', 'shwcp');
		$open_text = __('New window?', 'shwcp');
		?>
		<p><button class="button-primary add-custom-menu-link"><?php echo __('Add New', 'shwcp'); ?> </button></p>
		<table class="wcp-custom-links">
		<tbody>
		<?php
		$inc = 0;
		if (isset($this->first_tab['custom_links'])
			&& is_array($this->first_tab['custom_links'])
		) {
			foreach ($this->first_tab['custom_links'] as $k => $v) {
				if (isset($v['open']) 
					&& $v['open'] == 'on'
				) {
					$checked = 'checked="checked"';
				} else {
					$checked = '';
				}
				echo '<tr><td><input class="wcp-cust-link" name="' . $this->first_tab_key_db . '[custom_links][' . $inc . '][link]"' 
				   . ' placeholder="' . $link_text . '" value="' . $v['link'] . '" /></td>'

				   . '<td><input class="wcp-cust-url" name="' . $this->first_tab_key_db . '[custom_links][' . $inc . '][url]"'
				   . ' placeholder="' . $link_url_text . '" value="' . $v['url'] . '" /> '

				   . $open_text . ' <input type="checkbox" class="wcp-cust-url-open" name="' . $this->first_tab_key_db 
				   . '[custom_links][' . $inc . '][open]" ' . $checked . ' /></td>'

				   . '<td><a class="wcp-cust-delete">' . $delete_text . '</a> <i class="wcp-md md-sort"></i></td>'
				   . '</tr>';
				$inc++;
			}
		}

		?>
		</tbody>
		</table>
		<p><?php echo __('Add your own custom links to the slide out main menu.', 'shwcp'); ?></p>
		<div class="wcp-cust-link-text hide-me"><?php echo $link_text; ?></div>
		<div class="wcp-cust-link-url hide-me"><?php echo $link_url_text; ?></div>
		<div class="wcp-cust-del-text hide-me"><?php echo $delete_text; ?></div>
		<div class="wcp-cust-open-text hide-me"><?php echo $open_text; ?></div>

		<?php
	}

	/*
	 * Custom CSS Overrides
	 */
	function field_custom_css() {
		?>
		<textarea class="custom-css" id="code_editor_page_css" name="<?php echo $this->first_tab_key_db; ?>[custom_css]"><?php echo esc_attr( $this->first_tab['custom_css'] ); ?></textarea>
		<?php
	}

	/*
	 * Custom Javascript
	 */
	function field_custom_js() {
		?>
		<textarea class="custom-js" id="code_editor_page_js" name="<?php echo $this->first_tab_key_db; ?>[custom_js]"><?php echo esc_attr( $this->first_tab['custom_js'] ); ?></textarea>
		<?php
	}

	/*
	 * Use pagination for results
	 */
	function field_page_page() {
		?>
		<select class="wcp-page-page" name="<?php echo $this->first_tab_key_db; ?>[page_page]">
			<option value="true" <?php selected( $this->first_tab['page_page'], 'true'); ?>
				><?php echo __('True', 'shwcp'); ?></option>
			<option value="false" <?php selected( $this->first_tab['page_page'], 'false'); ?>
				><?php echo __('False', 'shwcp'); ?></option>
		</select>
		<p>
			<?php echo __("Use pagination for results (highly recommended), or show all results in view.", "shwcp"); ?>
		</p>
		<?php
	}
	/*
	 * Choose to show WP admin bar on the page
	 */
	function field_show_admin() {
		?>
		<select class="wcp-show-admin" name="<?php echo $this->first_tab_key_db; ?>[show_admin]">
			<option value="true" <?php selected( $this->first_tab['show_admin'], 'true'); ?>
                ><?php echo __('True', 'shwcp'); ?></option>
            <option value="false" <?php selected( $this->first_tab['show_admin'], 'false'); ?>
                ><?php echo __('False', 'shwcp'); ?></option>
        </select>
        <p>
            <?php echo __("Select if you want the Wordpress admin bar to show on Contacts page or not.", "shwcp"); ?>
        </p>
        <?php
    }
	/*
	 * If pagination set, result count per page
	 */
	function field_page_page_count() {
		?>
		<select class="wcp-page-page-count" name="<?php echo $this->first_tab_key_db; ?>[page_page_count]">
		<?php 
			for ($i = 1;$i < 201;$i++) {
		?>
			<option value="<?php echo $i; ?>" <?php selected ( $this->first_tab['page_page_count'], $i); ?>
				><?php echo $i; ?></option>
			<?php } ?>
		</select>	
		<p>
			<?php echo __("Set the pagination results per page","shwcp");?>
		</p>
		<?php
	
	}

	/*
	 * Default sorting field and direction for main page results
	 */
	function field_default_sort() {
		global $wpdb;
		$sort_table = $wpdb->get_results(
                "SELECT * from $this->table_sort order by sort_number desc");
		?>
		<select class="wcp-default-sort" name="<?php echo $this->first_tab_key_db; ?>[default_sort]">
		<?php
			foreach ($sort_table as $k => $v) {
		?>
			<option value="<?php echo $v->orig_name; ?>" <?php selected ( $this->first_tab['default_sort'], $v->orig_name); ?>
			 ><?php echo $v->translated_name; ?></option>
			 <?php } ?>
		</select>

		<select class="wcp-default-sort-dir" name="<?php echo $this->first_tab_key_db; ?>[default_sort_dir]">
		  <option value="desc" <?php selected ( $this->first_tab['default_sort_dir'], 'desc'); ?> >
		  <?php echo __('Descending', 'shwcp');?></option>
		  <option value="asc" <?php selected ( $this->first_tab['default_sort_dir'], 'asc'); ?> >
          <?php echo __('Ascending', 'shwcp');?></option>
		</select>
		<p>
			<?php echo __("Choose the Front Page default view sorting field and direction (default is ID Descending)", "shwcp");?>
		</p>
		<?php
	}

	/* 
	 * Color picker field callback, renders a 
	 * color picker
	 */
	function field_color_option() {
		?>
		<input type="text" name="<?php echo $this->first_tab_key_db; ?>[page_color]" class="color-field" value="<?php echo esc_attr( $this->first_tab['page_color'] ); ?>" />
		<p>
			<?php echo __('This sets the primary color for WP Contacts', 'shwcp');?>
		</p>

		<?php
	}

	/*
	 * Logo image upload
	 */
	function field_logo_image() {
		?>
		<button id="upload_now" class="button button-primary custom_media_upload"><?php echo __("Upload", "shwcp");?></button>
		<button class="button button-primary logo_clear"><?php echo __("Clear Image", "shwcp");?></button>
		<img class="wcp_logo_image" style="display:none;" src="<?php echo esc_attr( $this->first_tab['logo_attachment_url']);?>" />
		<input class="custom_media_url" type="text" style="display:none;" name="<?php echo $this->first_tab_key_db;?>[logo_attachment_url]" value="<?php echo esc_attr( $this->first_tab['logo_attachment_url']);?>">
		<input class="custom_media_id" type="text" style="display:none;" name="<?php echo $this->first_tab_key_db;?>[logo_attachment_id]" value="<?php echo esc_attr( $this->first_tab['logo_attachment_id']);?>">
		<?php
	}

	/*
	 * Footer Text field callback, textarea
	 */
	function field_footer_option() {
		?>
		<textarea name="<?php echo $this->first_tab_key_db; ?>[page_footer]"><?php echo esc_attr( $this->first_tab['page_footer'] ); ?> </textarea>
		<?php
	}

	/*
	 * Greeting Text For Login
	 */
	function field_greeting_option() {
        ?>
        <textarea name="<?php echo $this->first_tab_key_db; ?>[page_greeting]"><?php echo esc_attr( $this->first_tab['page_greeting'] ); ?>
 		</textarea>
		<p><?php echo __("Greeting Text on login form, keep it relatively short", "shwcp"); ?></p>
        <?php
    }

	/*
	 * Export File Name
	 */
	function field_export_file() {
		?>
		<input name="<?php echo $this->first_tab_key_db;?>[export_file]" value="<?php echo esc_attr($this->first_tab['export_file'] ); ?>"/>
        <p><?php echo __("The file name for csv and xls exports", "shwcp"); ?></p>
        <?php
    }

	/*
	 * Contact allow images
	 */
	function field_contact_image() {
			// set up display of upload form variable
			if (isset($this->first_tab['contact_image']) ) {
				if ($this->first_tab['contact_image'] == 'true') {
					$this->show_contact_upload = true;
				}
			}
		?>
		 <select class="wcp-contact-image" name="<?php echo $this->first_tab_key_db; ?>[contact_image]">
            <option value="false" <?php selected( $this->first_tab['contact_image'], 'false');?>
            ><?php echo __('False', 'shwcp'); ?></option>
            <option value="true" <?php selected( $this->first_tab['contact_image'], 'true');?>
            ><?php echo __('True', 'shwcp'); ?></option>
        </select>
        <p><?php echo __("Allow featured images for each entry.", 'shwcp'); ?></p>
        <?php
	}

	/*
	 * Default Contact Image for entries
	 */
	function field_default_image_url() {
		if ($this->show_contact_upload) {
			$display = 'display-contact';
		} else {
			$display = 'hide-contact';
		}
	?>
		<div class="contact-upload <?php echo $display;?>">
			<button id="upload_now2" class="button button-primary custom_contact_upload"><?php echo __("Upload", "shwcp");?>
			</button>
        	<button class="button button-primary contact_image_clear"><?php echo __("Clear Image", "shwcp");?></button>
        	<img class="wcp_contact_image" style="display:none;" 
				src="<?php echo esc_attr( $this->first_tab['contact_image_url']);?>" />
        	<input class="custom_contact_url" type="text" style="display:none;" 
				name="<?php echo $this->first_tab_key_db;?>[contact_image_url]" 
				value="<?php echo esc_attr( $this->first_tab['contact_image_url']);?>" />
        	<input class="custom_contact_id" type="text" style="display:none;" 
				name="<?php echo $this->first_tab_key_db;?>[contact_image_id]" 
				value="<?php echo esc_attr( $this->first_tab['contact_image_id']);?>" />
			<p><?php echo __("Set an Entry image to use as default for new entries.  Keep in mind the size of the image can affect page loading.", "shwcp"); ?></p>
		</div>
		<?php
	}

	/*
	 * Contact Image Front Page Thumb size
	 */
	function field_contact_thumbsize() {
		if ($this->first_tab['contact_image']) {
			$display = 'display-thumbsize';
		} else {
			$display = 'hide-thumbsize';
		}
	?>
		<div class="thumbnail-size <?php echo $display;?>">
			<input class="thumbnail-size" name="<?php echo $this->first_tab_key_db; ?>[contact_image_thumbsize]" 
            	value="<?php echo esc_attr( $this->first_tab['contact_image_thumbsize'] ); ?>" /> px
        	<p><?php echo __("This is the frontpage view thumbnail image size, defaults to 20px.  Keep it smaller for the table view and use only numbers.", "shwcp"); ?>
			</p> 
			<p><?php echo __("If you already have images set and are resizing, you can regenerate existing thumbnails under the Settings -> Manage Front Page area on the frontend.", 'shwcp'); ?></p>
		</div>
        <?php
    }
	
	/*
	 * Contacts allow file uploads
	 */
	function field_contact_upload() {
		?>
		 <select class="wcp-contact-upload" name="<?php echo $this->first_tab_key_db; ?>[contact_upload]">
            <option value="false" <?php selected( $this->first_tab['contact_upload'], 'false');?>
            ><?php echo __('False', 'shwcp'); ?></option>
            <option value="true" <?php selected( $this->first_tab['contact_upload'], 'true');?>
            ><?php echo __('True', 'shwcp'); ?></option>
        </select>
        <p><?php echo __("Allow file uploads for Contact entries.", 'shwcp'); ?></p>
        <?php
	}
	

	/* Permissions Tab Fields */

	/*
	 * Users with Manage Own Entries Only can or can't change ownership
	 */
	function field_manage_own_owner() {
		?>
		 <select class="own-leads-change-owner" name="<?php echo $this->permission_settings_key_db; ?>[own_leads_change_owner]">
		 	<option value="no" <?php selected ( $this->permission_settings['own_leads_change_owner'], 'no'); ?>>
            <?php echo __('No', 'shwcp'); ?></option>
            <option value="yes" <?php selected ( $this->permission_settings['own_leads_change_owner'], 'yes'); ?>>
			<?php echo __('Yes', 'shwcp'); ?></option>
        </select>
        <p>
            <?php echo __("Allow <b>Manage Own Entries</b> users to change entry ownership (hand entries off to other users) ?","shwcp");?>
        </p>
        <?php
	}

	/*
	 * User Permissions field callback
	 */
	 function field_user_permission() {
		$users = get_users();
		$access_levels = array(
			'none'     => __('No Access', 'shwcp'),
			'readonly' => __('Read Only', 'shwcp'),
			'ownleads' => __('Manage Own Entries', 'shwcp'),
			'full'     => __('Full Access', 'shwcp')
		);
		// add on any custom roles
		$custom_roles = isset($this->permission_settings['custom_roles']) ? $this->permission_settings['custom_roles'] : array();
		foreach ($custom_roles as $k => $role) {
			$access_levels[$role['unique']] = $role['name'];
		}
		//print_r($users);
		?>
			<hr />
			<br />
			<p><?php echo __('This version allows up to 3 active users maximum, full version is unlimited.  Choose users and access levels below.', 'shwcp');?></p>
			<table class="wcp_users">
				<tr>
					<th><?php echo __('System Access', 'shwcp');?></th><th><?php echo __('WP Username', 'shwcp');?></th><th><?php echo __('Access Level', 'shwcp');?></th>
				</tr>
		<?php
		$i = 0;
		foreach ($users as $user) { 
			$system_access = isset($this->permission_settings['system_access'][$user->ID]) ? $this->permission_settings['system_access'][$user->ID] : false;
			if ($system_access) {
				$system_access_class = "system-access-active";
			} else {
				$system_access_class = '';
			}
			$user_perm = isset($this->permission_settings['permission_settings'][$user->ID]) ? $this->permission_settings['permission_settings'][$user->ID] : 'none';


			$i++;
		?>
				<tr class="row<?php echo $i&1;?>">
					<td>
						<input type="checkbox" class="system-access system-access-<?php echo $user->ID;?>" 
							value="1" name="<?php echo $this->permission_settings_key_db;?>[system_access][<?php echo $user->ID;?>]" 
							<?php checked($system_access, 1);?> />
					</td>

					<td class="system-access-user <?php echo $system_access_class;?>"><?php echo $user->user_login; ?> </td>

					<td><select class="permission-level permission-level-<?php echo $user->ID;?>" 
		name="<?php echo $this->permission_settings_key_db;?>[permission_settings][<?php echo $user->ID; ?>]" <?php if (!$system_access) { echo "disabled='disabled'";}?>>
			<?php 
			if (!$system_access) { $user_perm = 'none'; }
			foreach ($access_levels as $av => $an) {
			?>
							<option value="<?php echo $av;?>" <?php selected ($user_perm, $av);?>><?php echo $an;?></option>
			<?php } ?>
						</select>
					</td>
				</tr>
		<?php } ?>
			</table>
	 <?php }

	/*
	 * Custom Roles field callback
	 */
	function field_custom_roles() {
		//print_r($this->permission_settings['custom_roles']);
		global $wpdb;
		$fields = $wpdb->get_results("SELECT * FROM $this->table_sort");

		//print_r($fields);
		$fo_explain = __('You can choose to hide certain fields for this user role.  An example usecase would be if you wanted some fields with sensitive information protected from this role.  This applies to exports as well.', 'shwcp');   
	?>	
		<p><button class="button-primary wcp-custom-role"><?php echo __('Add New Role', 'shwcp'); ?></button></p>
		<p><?php echo __('Before removing any custom roles, make sure none of your users are assigned to it.', 'shwcp');?></p>
		<p><?php echo __('Some features must be enabled in main settings (e.g. file uploads, entry photos, events.) before access is available.', 'shwcp');?></p>
		<p class="cust-role-msg hidden"><?php echo __('Click to expand/collapse', 'shwcp');?></p>
		<table class="wcp-user-roles">

		<?php
		// insert any existing roles
			if (isset($this->permission_settings['custom_roles'])
            && is_array($this->permission_settings['custom_roles'])
        ) {
				$inc = 0;
            	foreach ($this->permission_settings['custom_roles'] as $k => $v) { 
					$inc++;	
				?>
					<tr class="wcp-spacer"></tr>
					<tr class="wcp-custrole-header wcp-parent" id="wcprow-<?php echo $inc;?>"><th colspan="3"><?php echo $inc;?>.) <?php echo $v['name'];?></th></tr>
					<tr class="cust-role-row child-wcprow-<?php echo $inc;?> row-<?php echo $inc;?>">
					  <td class="role-name">	
						<p class="role-title"><?php echo __('Unique Role Name', 'shwcp');?></p>
						<input class="wcp-cust-role" 
						name="<?php echo $this->permission_settings_key_db;?>[custom_roles][<?php echo $inc;?>][name]" 
						placeholder="<?php echo __('Role Name', 'shwcp');?>" value="<?php echo $v['name'];?>" />

						<input class="wcp-cust-unique hide-me" 
                        name="<?php echo $this->permission_settings_key_db;?>[custom_roles][<?php echo $inc;?>][unique]" 
                        value="<?php echo $v['unique'];?>" />
					  </td>

					  <td class="role-access">
					  	<?php /** This table is the same as the hidden one below only with options filled for saved entries **/ ?>
						<table class="wcp-table-access-options">
                		  <tr>
                    		<td class="option-name entries_add">
                        	  <p class="role-title"><?php echo __('Add Entries', 'shwcp'); ?></p>
                        	  <input type="radio" 
							  name="<?php echo $this->permission_settings_key_db;?>[custom_roles][<?php echo $inc;?>][entries_add]" 
							  value="yes" <?php checked($v['entries_add'], 'yes');?>><?php echo __('Yes', 'shwcp');?> 
							  <br />
                        	  <input type="radio" 
							  name="<?php echo $this->permission_settings_key_db;?>[custom_roles][<?php echo $inc;?>][entries_add]" 
							  value="no" <?php checked($v['entries_add'], 'no');?>><?php echo __('No', 'shwcp');?> 
							  <br />
                    		</td>
                    		<td class="option-name entries_delete">
                        	  <p class="role-title"><?php echo __('Delete Entries', 'shwcp'); ?></p>

                        	  <input type="radio" 
							  name="<?php echo $this->permission_settings_key_db;?>[custom_roles][<?php echo $inc;?>][entries_delete]" 
							  value="all" <?php checked($v['entries_delete'], 'all');?>>
							  <?php echo __('Delete Any Entries', 'shwcp');?><br />

                        	  <input type="radio" name="<?php echo $this->permission_settings_key_db;?>[custom_roles][<?php echo $inc;?>][entries_delete]" 
							  value="own" <?php checked($v['entries_delete'], 'own');?>>
							  <?php echo __('Delete Own Entries', 'shwcp');?><br />

                        	  <input type="radio" 
							  name="<?php echo $this->permission_settings_key_db;?>[custom_roles][<?php echo $inc;?>][entries_delete]" 
							  value="none" <?php checked($v['entries_delete'], 'none');?>><?php echo __('None', 'shwcp');?><br />
                    		</td>
                    		<td class="option-name entries_view">
                        	  <p class="role-title"><?php echo __('View Entries', 'shwcp'); ?></p>
                        	  <input type="radio" 
							  name="<?php echo $this->permission_settings_key_db;?>[custom_roles][<?php echo $inc;?>][entries_view]" 							  value="all" <?php checked($v['entries_view'], 'all');?>>
							  <?php echo __('View All Entries', 'shwcp');?><br />

                        	  <input type="radio" 
							  name="<?php echo $this->permission_settings_key_db;?>[custom_roles][<?php echo $inc;?>][entries_view]" 							  value="own" <?php checked($v['entries_view'], 'own');?>>
							  <?php echo __('View Own Entries', 'shwcp');?><br />
                    	    </td>
                		  </tr>
                		  <tr>
						  	<td class="option-name entries_edit">
                              <p class="role-title"><?php echo __('Edit Entries', 'shwcp'); ?></p>
                              <input type="radio" 
                              name="<?php echo $this->permission_settings_key_db;?>[custom_roles][<?php echo $inc;?>][entries_edit]"
                              value="all" class="entries_edit_option"
							  <?php checked($v['entries_edit'], 'all');?>><?php echo __('Edit Any Entries', 'shwcp');?>
                              <br />
                              <input type="radio" 
                              name="<?php echo $this->permission_settings_key_db;?>[custom_roles][<?php echo $inc;?>][entries_edit]"
                              value="own" class="entries_edit_option"
							  <?php checked($v['entries_edit'], 'own');?>><?php echo __('Edit Own Entries', 'shwcp');?>
                              <br />
                              <input type="radio" 
                              name="<?php echo $this->permission_settings_key_db;?>[custom_roles][<?php echo $inc;?>][entries_edit]"
                              value="none" class="entries_edit_option"
							  <?php checked($v['entries_edit'], 'none');?>><?php echo __('None', 'shwcp');?>
                              <br />
                            </td>
							<td class="option-name entries_ownership">
                              <p class="role-title"><?php echo __('Change Entry Ownership', 'shwcp'); ?></p>
                              <input type="radio" 
                              name="<?php echo $this->permission_settings_key_db;?>[custom_roles][<?php echo $inc;?>][entries_ownership]"
                              value="yes" <?php checked($v['entries_ownership'], 'yes');?>><?php echo __('Can Change', 'shwcp');?>
                              <br />
                              <input type="radio" 
                              name="<?php echo $this->permission_settings_key_db;?>[custom_roles][<?php echo $inc;?>][entries_ownership]"
                              value="no" <?php checked($v['entries_ownership'], 'no');?>><?php echo __('Cannot Change', 'shwcp');?>
                              <br />
                            </td>
                    	    <td class="option-name manage_entry_files">
                        	  <p class="role-title"><?php echo __('Manage Entry Files', 'shwcp'); ?></p>
                        	
							  <input type="radio" 
						      name="<?php echo $this->permission_settings_key_db;?>[custom_roles][<?php echo $inc;?>][manage_entry_files]" 
							  value="yes" <?php checked($v['manage_entry_files'], 'yes');?>><?php echo __('Yes', 'shwcp');?><br />

                        	  <input type="radio" 
							  name="<?php echo $this->permission_settings_key_db;?>[custom_roles][<?php echo $inc;?>][manage_entry_files]" 
							  value="no" <?php checked($v['manage_entry_files'], 'no');?>><?php echo __('No', 'shwcp');?><br />
                    	    </td>
                    	    <td class="option-name manage_entry_photo">
                        	  <p class="role-title"><?php echo __('Manage Entry Photo', 'shwcp'); ?></p>
                        	  <input type="radio" 
							  name="<?php echo $this->permission_settings_key_db;?>[custom_roles][<?php echo $inc;?>][manage_entry_photo]" 
							  value="yes" <?php checked($v['manage_entry_photo'], 'yes');?>><?php echo __('Yes', 'shwcp');?><br />
                        	  <input type="radio" 
							  name="<?php echo $this->permission_settings_key_db;?>[custom_roles][<?php echo $inc;?>][manage_entry_photo]" 
							  value="no" <?php checked($v['manage_entry_photo'], 'no');?>><?php echo __('No', 'shwcp');?><br />
                    	    </td>
                		  </tr>
                		  <tr>
                    	    <td class="option-name manage_front">
                        	  <p class="role-title"><?php echo __('Manage Settings - Front Page', 'shwcp'); ?></p>
                        	  <input type="radio" 
							  name="<?php echo $this->permission_settings_key_db;?>[custom_roles][<?php echo $inc;?>][manage_front]" 
							  value="yes" <?php checked($v['manage_front'], 'yes');?>><?php echo __('Yes', 'shwcp');?><br />

                        	  <input type="radio" 
							  name="<?php echo $this->permission_settings_key_db;?>[custom_roles][<?php echo $inc;?>][manage_front]" 
							  value="no" <?php checked($v['manage_front'], 'no');?>><?php echo __('No', 'shwcp');?><br />
                    	    </td>
                    	    <td class="option-name manage_fields">
                              <p class="role-title"><?php echo __('Manage Settings - Fields', 'shwcp'); ?></p>
                              <input type="radio" 
						      name="<?php echo $this->permission_settings_key_db;?>[custom_roles][<?php echo $inc;?>][manage_fields]" 
						      value="yes" <?php checked($v['manage_fields'], 'yes');?>><?php echo __('Yes', 'shwcp');?><br />

                              <input type="radio" 
						      name="<?php echo $this->permission_settings_key_db;?>[custom_roles][<?php echo $inc;?>][manage_fields]" 
						      value="no" <?php checked($v['manage_fields'], 'no');?>><?php echo __('No', 'shwcp');?><br />
                    	    </td>
                    	    <td class="option-name manage_individual">
                              <p class="role-title"><?php echo __('Manage Settings - Individual Page', 'shwcp'); ?></p>

                              <input type="radio" 
						      name="<?php echo $this->permission_settings_key_db;?>[custom_roles][<?php echo $inc;?>][manage_individual]" 
						      value="yes" <?php checked($v['manage_individual'], 'yes');?>><?php echo __('Yes', 'shwcp');?><br />

                              <input type="radio" 
						      name="<?php echo $this->permission_settings_key_db;?>[custom_roles][<?php echo $inc;?>][manage_individual]"
						      value="no" <?php checked($v['manage_individual'], 'no');?>><?php echo __('No', 'shwcp');?><br />
                    	    </td>
                	  	  </tr>
                		  <tr>
                    		<td class="option-name access_import">
                        	  <p class="role-title"><?php echo __('Import Entries', 'shwcp'); ?></p>
                        	  <input type="radio" 
							  name="<?php echo $this->permission_settings_key_db;?>[custom_roles][<?php echo $inc;?>][access_import]" 
							  value="yes" <?php checked($v['access_import'], 'yes');?>><?php echo __('Yes', 'shwcp');?><br />

                        	  <input type="radio" 
							  name="<?php echo $this->permission_settings_key_db;?>[custom_roles][<?php echo $inc;?>][access_import]" 
							  value="no" <?php checked($v['access_import'], 'no');?>><?php echo __('No', 'shwcp');?><br />
                    		</td>
                    		<td class="option-name access_export">
                        	  <p class="role-title"><?php echo __('Export Entries', 'shwcp'); ?></p>
                        	  <input type="radio" 
							  name="<?php echo $this->permission_settings_key_db;?>[custom_roles][<?php echo $inc;?>][access_export]" 
							  value="all" <?php checked($v['access_export'], 'all');?>><?php echo __('Export All', 'shwcp');?><br />

                        	  <input type="radio" 
							  name="<?php echo $this->permission_settings_key_db;?>[custom_roles][<?php echo $inc;?>][access_export]" 
							  value="own" <?php checked($v['access_export'], 'own');?>><?php echo __('Export Own', 'shwcp');?><br />

                        	  <input type="radio" 
							  name="<?php echo $this->permission_settings_key_db;?>[custom_roles][<?php echo $inc;?>][access_export]" 
							  value="none" <?php checked($v['access_export'], 'none');?>><?php echo __('None', 'shwcp');?><br />
                    		</td>
                    		<td class="option-name access_events">
                    		</td>
                		  </tr>

            			</table>


					  </td>

					  <td class="remove-cust">
						<div class="remove-cont">
						  <div class="remove-button" title="<?php echo __('Remove This Role', 'shwcp');?>">
							<i class="md-clear"></i>
						  </div>
						</div>
					  </td>
					</tr>
				<?php
				}
			}

		?>
		</table>
		<div class="wcp-role-name hide-me"><?php echo __('Role Name', 'shwcp'); ?></div>
		<div class="wcp-role-label hide-me"><?php echo __('Unique Role Name', 'shwcp'); ?></div>
		<div class="remove-role-text hide-me"><?php echo __('Remove This Role', 'shwcp'); ?></div>
		<div class="wcp-permissions-option hide-me"><?php echo $this->permission_settings_key . $this->db;?></div>
		<div class="wcp-access-options hide-me"><!--Hidden template -->
			<table class="wcp-table-access-options">
				<tr>
					<td class="option-name entries_add">
                        <p class="role-title"><?php echo __('Add Entries', 'shwcp'); ?></p>
                        <input type="radio" name="" value="yes"><?php echo __('Yes', 'shwcp');?><br />
                        <input type="radio" name="" value="no" checked="checked"><?php echo __('No', 'shwcp');?><br />
                    </td> 
                    <td class="option-name entries_delete">
                        <p class="role-title"><?php echo __('Delete Entries', 'shwcp'); ?></p>
                        <input type="radio" name="" value="all"><?php echo __('Delete Any Entries', 'shwcp');?><br />
                        <input type="radio" name="" value="own"><?php echo __('Delete Own Entries', 'shwcp');?><br />
                        <input type="radio" name="" value="none" checked="checked"><?php echo __('None', 'shwcp');?><br />
                    </td> 
					<td class="option-name entries_view">
                        <p class="role-title"><?php echo __('View Entries', 'shwcp'); ?></p>
                        <input type="radio" name="" value="all"><?php echo __('View All Entries', 'shwcp');?><br />
                        <input type="radio" name="" value="own" checked="checked"><?php echo __('View Own Entries', 'shwcp');?><br />
                    </td>
				</tr>
				<tr>
					<td class="option-name entries_edit">
                    	<p class="role-title"><?php echo __('Edit Entries', 'shwcp'); ?></p>
                        <input type="radio" name="" value="all" class="entries_edit_option"><?php echo __('Edit Any Entries', 'shwcp');?><br />
                        <input type="radio" name="" value="own" class="entries_edit_option"><?php echo __('Edit Own Entries', 'shwcp');?><br />
                        <input type="radio" name="" value="none" class="entries_edit_option" checked="checked"><?php echo __('None', 'shwcp');?><br />
                    </td>
                    <td class="option-name entries_ownership wcp-disabled">
                        <p class="role-title"><?php echo __('Change Entry Ownership', 'shwcp'); ?></p>
                        <input type="radio" name="" value="yes"><?php echo __('Can Change', 'shwcp');?><br />
                        <input type="radio" name="" value="no" checked="checked"><?php echo __('Cannot Change', 'shwcp');?><br />
                    </td>
					<td class="option-name manage_entry_files wcp-disabled">
                        <p class="role-title"><?php echo __('Manage Entry Files', 'shwcp'); ?></p>
                        <input type="radio" name="" value="yes"><?php echo __('Yes', 'shwcp');?><br />
                        <input type="radio" name="" value="no" checked="checked"><?php echo __('No', 'shwcp');?><br />
                    </td>   
                    <td class="option-name manage_entry_photo wcp-disabled">
                        <p class="role-title"><?php echo __('Manage Entry Photo', 'shwcp'); ?></p>
                        <input type="radio" name="" value="yes"><?php echo __('Yes', 'shwcp');?><br />
                        <input type="radio" name="" value="no" checked="checked"><?php echo __('No', 'shwcp');?><br />
                    </td> 
				</tr>
				<tr>
					<td class="option-name manage_front">
						<p class="role-title"><?php echo __('Manage Settings - Front Page', 'shwcp'); ?></p>
						<input type="radio" name="" value="yes"><?php echo __('Yes', 'shwcp');?><br />
						<input type="radio" name="" value="no" checked="checked"><?php echo __('No', 'shwcp');?><br />
                    </td>	
					<td class="option-name manage_fields">
                        <p class="role-title"><?php echo __('Manage Settings - Fields', 'shwcp'); ?></p>
                        <input type="radio" name="" value="yes"><?php echo __('Yes', 'shwcp');?><br />
                        <input type="radio" name="" value="no" checked="checked"><?php echo __('No', 'shwcp');?><br />
                    </td> 
					<td class="option-name manage_individual">
                        <p class="role-title"><?php echo __('Manage Settings - Individual Page', 'shwcp'); ?></p>
                        <input type="radio" name="" value="yes"><?php echo __('Yes', 'shwcp');?><br />
                        <input type="radio" name="" value="no" checked="checked"><?php echo __('No', 'shwcp');?><br />
                    </td> 
				</tr>
				<tr>
                    <td class="option-name access_import">
                        <p class="role-title"><?php echo __('Import Entries', 'shwcp'); ?></p>
                        <input type="radio" name="" value="yes"><?php echo __('Yes', 'shwcp');?><br />
                        <input type="radio" name="" value="no" checked="checked"><?php echo __('No', 'shwcp');?><br />
                    </td> 
					<td class="option-name access_export">
                        <p class="role-title"><?php echo __('Export Entries', 'shwcp'); ?></p>
                        <input type="radio" name="" value="all"><?php echo __('Export All', 'shwcp');?><br />
						<input type="radio" name="" value="own"><?php echo __('Export Own', 'shwcp');?><br />
                        <input type="radio" name="" value="none" checked="checked"><?php echo __('None', 'shwcp');?><br />
                    </td> 
					<td class="option-name access_events">
                    </td> 
                </tr>
				<tr>
                    <td class="option-name field_override" colspan="4">
                        <p class="role-title">
							<?php echo __('Individual Field Overrides', 'shwcp');?>
							<span class="fo_explain" title="<?php echo $fo_explain;?>">?</span>
						</p>
                        <input type="radio" class="field_override_enable" name="" value="yes"><?php echo __('Enable', 'shwcp');?>
                        <br />
                        <input type="radio" class="field_override_enable" name="" value="no" checked="checked"><?php echo __('Disabled', 'shwcp');?>
                   </td>
                </tr>

                          <tr>
                            <td colspan="4"><table class="field_override_fields" style="display:none">
<?php
                    $inc_fo = 0;
?>
                             <tr>
<?php
                    foreach ($fields as $k => $val) {
                        if ($inc_fo == 8) {
                            $inc_fo = 0;   
?>
                              </tr><tr>
                <?php   }  ?>
                                <td>
                                  <p class="fo_title"><?php echo $val->translated_name;?></p>
								  <p class="fo_orig_name hidden"><?php echo $val->orig_name;?></p>
                                  <input type="radio" name="" value="shown" checked="checked"><?php echo __('Shown', 'shwcp');?>
                                  <br />
                                  <input type="radio" name="" value="hidden"><?php echo __('Hidden', 'shwcp');?>
                                  <br />
                                </td>
<?php
                        $inc_fo++;
                    }
?>

                              </tr>
                            </table></td>
                          </tr>
				
			</table>
		</div>
	

	<?php }

	/*
	 * Site information field callback
	 */
	function field_section_info() { 
		?>
		<table class="wcp_site_info">
			<tr>
				<th<?php __('Variable', 'shwcp'); ?></th>
				<th><?php __('Value', 'shwcp'); ?></th>
			</tr>
			<tr class="row1"><td><?php echo __('PHP version running', 'shwcp');?></td><td><?php echo phpversion(); ?></td></tr>
			<tr class="row0"><td>post_max_size</td><td><?php echo ini_get('post_max_size'); ?></td></tr>
		 	<tr class="row1"><td>memory_limit</td><td><?php echo ini_get('memory_limit'); ?></td> </tr>
			<tr class="row0"><td>upload_max_filesize</td><td><?php echo ini_get('upload_max_filesize'); ?></td></tr>
			<tr class="row1"><td>max_execution_time</td><td><?php echo ini_get('max_execution_time'); ?></td></tr>
			<tr class="row0"><td>max_file_uploads</td><td><?php echo ini_get('max_file_uploads'); ?></td></tr>
			<tr class="row1"><td>max_input_vars</td><td><?php echo ini_get('max_input_vars'); ?></td></tr>
		</table>
	<?php }

	/*
	 * Backup DB (tab 4) ajax only
     */
	function field_backup_db() {
		$wait = SHWCP_ROOT_URL . '/assets/img/wait.gif';
	?>
		<!-- Backup Database -->
        <hr>
        <table class="wcp_backup_db">
            <tr>
              <td>
                <div class="backup-db-div left-content">
                  <input type="checkbox" class="backup-db-check" value="none" />
                        <?php echo __('Backup Database', 'shwcp');?>
                        <br />
                </div>
                <div class="confirm-button right-content">
                     <button class="backup-db-confirm button button-primary">
                     <?php echo __('Backup Database Now', 'shwcp');?></button>
                </div>
                <div class="clear-both"></div>
                <br />
                <div class="backup-message">
                <b>
                    <?php echo __('This will create a new backup of the current state of your database.', 'shwcp'); ?>
                </b>
                </div>
                <div class="backup-success">
                    <span class="success-msg">
                    <?php echo __('Database has been backed up!', 'shwcp'); ?>
                    </span>
                </div>
				<div class="backup-wait">
                    <span class="wait-msg">
                    <?php echo __('Please Wait, while the database is backed up.', 'shwcp'); ?>  <img src="<?php echo $wait; ?>" />
                    </span>
                </div>
				<div class="current-working-database" style="display:none;"><?php echo $this->db;?></div>

              </td>
            </tr>
        </table>
        <hr>

	<?php }


	/*
     * Restore DB (tab 4) ajax only
     */
    function field_restore_db() {
		$wait = SHWCP_ROOT_URL . '/assets/img/wait.gif';
    ?>
        <!-- Restore Database -->
        <hr>
        <table class="wcp_restore_db">
            <tr>
              <td>
                <div class="restore-db-div left-content">
                  <input type="checkbox" class="restore-db-check" value="none" />
                        <?php echo __('Restore Database', 'shwcp');?>
                        <br />
					<select class="restore-db-file">
						<option value="" selected="selected"><?php echo __('--SELECT--', 'shwcp'); ?></option>
					<?php
					$i = 1;
                	foreach ($this->backup_files as $k => $v) {
                    	$files_info[$i]['name'] = $v;
                    	$size = size_format(get_dirsize($this->shwcp_backup . '/' . $v));
                    	echo "<option value='$v'>$i). <span class='backup-entry'>$v</span>"
							. " $size</option>\n";
                    	$i++;
                	}
					?>
					</select>
                </div>
                <div class="confirm-button right-content">
                     <button class="restore-db-confirm button button-primary button-warning">
                     <?php echo __('Confirm Database Restore', 'shwcp');?></button>
                </div>
                <div class="clear-both"></div>
                <br />
                <div class="restore-message">
                <b>
                    <?php echo __('This option will restore a backup of your choice back into the database (and overwrite existing entry data).', 'shwcp'); ?>
                </b>
                </div>
                <div class="restore-success">
                    <span class="success-msg">
                    <?php echo __('Database has been Restored!', 'shwcp'); ?>
                    </span>
                </div>
				<div class="restore-wait">
					<span class="wait-msg">
					<?php echo __('Please Wait, while the database is restored.', 'shwcp'); ?> <img src="<?php echo $wait; ?>" />
					</span>
				</div>
              </td>
            </tr>
        </table>
        <hr>

    <?php }

	/*
	 * List current backups (tab 4) 
	 *
	 * Notes:
	 * For the download backups jquery isn't the best method for downloading files, so we need to form submit
     * and since the page is wrapped in a form we can't have a nested form.  We will instead append forms with 
     * jquery and submit them in one step to admin-post.php where we can return the file.
     */
	public function field_backups_list() {
	?>
		<div class="current-backups">
        	<ul class="backup-ul">
           		<?php
                // get sizes and dates
                $i = 1;
                foreach ($this->backup_files as $k => $v) {
                    $files_info[$i]['name'] = $v;
                    $size = size_format(get_dirsize($this->shwcp_backup . '/' . $v));
                    $file_date = date("m-d-Y H:i:s", filemtime($this->shwcp_backup . '/' . $v));
                    echo "<li>$i). <b><span class='backup-entry'>$v</span> </b> <i>$file_date</i> $size |"
						 . " <a href='#' class='remove-backup'>" . __('Delete Backup', 'shwcp') . "</a> |"
						 . " <a href='#' class='download-backup' id='download_backup_$i'>" . __('Download Backup', 'shwcp') . "</a></li>\n";
                    $i++;
                }
                ?>
			</ul>
			<div class="download-backup-url hidden"><?php echo admin_url();?>admin-post.php</div>
			<div class="download-backup-nonce hidden"><?php echo wp_nonce_field( 'wcp_dlb_nonce', 'wcp_dlb_nonce', false, false ); ?></div>
        </div>	
	<?php }

	/*
	 * Reset DB to defaults (tab 4) ajax only
	 */
	function field_reset_db() {
	?>
		<!-- Restore Contacts Database -->

		<!-- Reset Contacts Database -->
		<hr>
		<table class="wcp_reset_db">
			<tr>
			  <td>
				<div class="reset-db-div left-content">
				  <input type="checkbox" class="reset-db-check" value="none" />
                       	<?php echo __('Reset Database to Defaults', 'shwcp');?>
						<br />
				</div>
				<div class="confirm-button right-content">
					 <button class="reset-db-confirm button button-primary button-warning">
				     <?php echo __('Confirm Database Reset', 'shwcp');?></button>
				</div>
				<div class="clear-both"></div>
				<br />
				<div class="reset-message">
				<b>
					<?php echo __('Warning, this action will clear all entries (and data) and restore the database to default (like a new installation).', 'shwcp'); ?>
				</b>
					<?php echo __('  Use this only if you want to start over fresh again.  Your Main Settings and Permissions will remain intact.', 'shwcp'); ?>
				</div>
				<div class="reset-success">
					<span class="success-msg">
					<?php echo __('Database has been reset to the initial state, you can now go to the frontend and start working with it again.', 'shwcp'); ?>
					</span>
				</div>
			  </td>
			</tr>
		</table>
		<hr>
	<?php }

			



	/*
	 * Called during admin_menu, adds an options
	 * page under Settings called My Settings, rendered
	 * using the plugin_options_page method.
	 */
	function add_admin_menus() {
		$plugin_options = add_menu_page( __('WP Contacts Slim', 'shwcp'), __('WP Contacts Slim', 'shwcp'), 'manage_options', 
				$this->plugin_options_key, array($this, 'plugin_options_page'), 
				SHWCP_ROOT_URL . '/assets/img/wcp-16.png', '27.337');

		// loaded only in our Contacts menu
		add_action( 'load-' . $plugin_options, array($this, 'load_admin_scripts') );
	}

	/*
	 * Submenu functionality added to our admin menu for add, delete and selecting databases
	 */
	function add_admin_submenus() {
		// get the default database name
		$default_db = get_option( $this->first_tab_key );	
		if (!isset($default_db['database_name']) || $default_db['database_name'] == '' ) {
			$default_name = __('Default Database', 'shwcp');
		} else {
			$default_name = $default_db['database_name'];
		}

		// Default
		add_submenu_page( $this->plugin_options_key, $default_name, $default_name, 
            'manage_options', $this->plugin_options_key);

		// All other databases created based on options name
		global $wpdb;
		$options_table = $wpdb->prefix . 'options';
		$option_entry = $this->first_tab_key;
		$dbs = $wpdb->get_results("SELECT * FROM $options_table WHERE `option_name` LIKE '%$option_entry%'");
		//print_r($dbs);
		foreach ($dbs as $k => $option) {
			if ($option->option_name == $option_entry) {
				// ignore since it's set above (Default)
			} else {
				$db_options = get_option($option->option_name);
				$remove_name = '/^' . $option_entry . '_/';  // Just get the database number
				$db_number = preg_replace($remove_name, '', $option->option_name);
				if (is_numeric($db_number)) {
					add_submenu_page( $this->plugin_options_key, $db_options['database_name'], $db_options['database_name'],
            			'manage_options', $this->plugin_options_key . '&db=' . $db_number, '__return_null');
				}
			}
		}
	}
	
	/* Only called on our plugin tabs page */
	function load_admin_scripts() {
		/* Can't enqueue scripts here, it's too early, so register against proper action hook first */
		add_action( 'admin_enqueue_scripts', array( $this, 'admin_enqueue_scripts' ), 10, 1 );
        add_action( 'admin_enqueue_scripts', array( $this, 'admin_enqueue_styles' ), 10, 1 );
	}

	/* Only called on our add & remove database page */
 	function load_admindb_scripts() {
		/* Can't enqueue scripts here, it's too early, so register against proper action hook first */
		add_action( 'admin_enqueue_scripts', array( $this, 'admin_enqueue_db_scripts' ), 10, 1 );
		add_action( 'admin_enqueue_scripts', array( $this, 'admin_enqueue_db_styles' ), 10, 1 );
	}

	/**
     * Load admin Javascript.
     * @access public
     * @since 1.0.0
     * @return void
     */
    public function admin_enqueue_scripts ( $hook = '' ) {
    	wp_enqueue_media();
		wp_enqueue_script('jquery-ui-sortable');

		wp_register_script( 'wcp-admin',
		SHWCP_ROOT_URL . '/assets/js/admin.js', array( 'wp-color-picker' ), SHWCP_PLUGIN_VERSION, true );
		wp_enqueue_script( 'wcp-admin' );
		wp_localize_script(  'wcp-admin', 'WCP_Ajax_Admin', array(
        	'ajaxurl' => admin_url('admin-ajax.php'),
            'nextNonce' => wp_create_nonce( 'myajax-next-nonce' )
        ));
		wp_enqueue_code_editor( array( 'type' => 'text/html' ) );
	} // End admin_enqueue_scripts

	/**
     * Load admin Javascript for db pages
     * @access public
     * @since 2.0.0
	 * @return void
     */
	public function admin_enqueue_db_scripts ($hook = '' ) {
		wp_register_script( 'wcp-admin-db',
		SHWCP_ROOT_URL . '/assets/js/admin-addremove-db.js', array( 'jquery' ), SHWCP_PLUGIN_VERSION, true );
		wp_enqueue_script( 'wcp-admin-db' );
		wp_localize_script( 'wcp-admin-db', 'WCP_Ajax_DB_Admin', array( 
			'ajaxurl' => admin_url('admin-ajax.php'),
			'nextNonce' => wp_create_nonce( 'myajax-next-nonce' )
		));
	} // End admin_enqueue_db_scripts
	
	/**
	 * Load admin CSS.
     * @access public
     * @since 1.0.0
     * @return void
     */
	public function admin_enqueue_styles ( $hook = '' ) {
		// Add the color picker css file      
		wp_enqueue_style( 'wp-color-picker' );

		wp_register_style( 'wcp-admin', SHWCP_ROOT_URL . '/assets/css/admin.css', array(), SHWCP_PLUGIN_VERSION );
		wp_enqueue_style( 'wcp-admin' );
		
		// material design fonts
		wp_register_style( 'md-iconic-font', SHWCP_ROOT_URL
	         . '/assets/css/material-design-iconic-font/css/material-design-iconic-font.min.css', '1.1.1' );
	    wp_enqueue_style( 'md-iconic-font' );

	} // End admin_enqueue_styles

	/**
     * Load admin db CSS.
     * @access public
     * @since 2.0.0
     * @return void
     */
    public function admin_enqueue_db_styles ( $hook = '' ) {
		// no styles needed yet

    } // End admin_enqueue_styles


	
	/*
	 * Plugin Options page rendering goes here, checks
	 * for active tab and replaces key with the related
	 * settings key. Uses the plugin_options_tabs method
	 * to render the tabs.
	 */
	function plugin_options_page() {
		$tab = isset( $_GET['tab'] ) ? $_GET['tab'] : $this->first_tab_key_db;
		//$db = isset($_GET['db'] ) ? '_' . $_GET['db'] : '';
		//$tab_db = $tab . $db;
		?>
		<div class="wrap">
			<?php $this->plugin_options_tabs(); ?>
			<form method="post" action="options.php">
				<?php wp_nonce_field( 'update-options' ); ?>
				<?php settings_fields( $tab ); ?>
				<?php do_settings_sections( $tab ); ?>
				<?php submit_button(); ?>
			</form>
		</div>
		<?php
	}
	
	/*
	 * Renders our tabs in the plugin options page,
	 * walks through the object's tabs array and prints
	 * them one by one. Provides the heading for the
	 * plugin_options_page method.
	 */
	function plugin_options_tabs() {
		$db_text = __('Database', 'shwcp');
		$current_tab = isset( $_GET['tab'] ) ? $_GET['tab'] : $this->first_tab_key_db;
		echo '<h2 class="shwcp-database">' . $this->first_tab['database_name'] 
			. '<span class="shwcp-small-htext">' . $db_text . '</span></h2>';
		echo '<h2 class="nav-tab-wrapper">';
		foreach ( $this->plugin_settings_tabs as $tab_key => $tab_caption ) {
			$active = $current_tab == $tab_key ? 'nav-tab-active' : '';
			echo '<a class="nav-tab ' . $active . '" href="?page=' . $this->plugin_options_key 
				. '&tab=' . $tab_key . '">' . $tab_caption . '</a>';	
		}
		echo '</h2>';
	}
};

// Initialize the plugin
add_action( 'plugins_loaded', function() {$settings_api_tabs_shwcp = new SHWCP_API_Tabs;} );
