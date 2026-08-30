import os
import json
import math
from enum import Enum
from PIL import Image, ImageDraw, ImageFont
from .logging import *


# Constants
DEFAULT_COLOR_MODE = "RGBA"
DEFAULT_FILE_FORMAT = "PNG"
PIL_MAX_CHANNEL_VALUE = 255
DEFAULT_ALPHA_CHANNEL_VALUE = 255
ROW_SETTINGS_FILE_NAME = "row_settings.json"


# Enums
class SpriteAlign(Enum):
    TOP_LEFT = "Top Left"
    TOP_CENTER = "Top Center"
    TOP_RIGHT = "Top Right"
    MIDDLE_LEFT = "Middle Left"
    MIDDLE_CENTER = "Middle Center"
    MIDDLE_RIGHT = "Middle Right"
    BOTTOM_LEFT = "Bottom Left"
    BOTTOM_CENTER = "Bottom Center"
    BOTTOM_RIGHT = "Bottom Right"
class SpriteConsistency(Enum):
    INDIVIDUAL = "Individual Consistent"
    ROW = "Row Consistent"
    ALL = "All Consistent"
class CombineMode(Enum):
    IMAGES = "Images"
    STRIPS = "Strips"
    SHEET = "Sheet"


# Row settings defaults, used as fallback if row_settings.json missing or key missing
DEFAULT_FONT_SIZE = 24
DEFAULT_LABEL_COLOR = (1.0, 1.0, 1.0, 1.0)
DEFAULT_LABEL_MARGIN = 15
DEFAULT_IMAGE_MARGIN = 15
DEFAULT_SPRITE_CONSISTENCY = SpriteConsistency.ROW
DEFAULT_SPRITE_ALIGN = SpriteAlign.BOTTOM_CENTER
DEFAULT_LABEL_SHOW_FRAME_COUNT = False
DEFAULT_LABEL_SHOW_ROW_SIZE = False
DEFAULT_MAX_COLUMNS = 0
DEFAULT_ROW_MARGIN = DEFAULT_LABEL_MARGIN
DEFAULT_SUB_ROW_MARGIN = DEFAULT_IMAGE_MARGIN


# Classes
class RowData:
    def __init__(self):
        self.label_text:str = "Untitled"
        self.label_color:tuple = DEFAULT_LABEL_COLOR
        self.label_font_size:int = DEFAULT_FONT_SIZE
        self.label_margin:int = DEFAULT_LABEL_MARGIN
        self.images:list[list] = []
        self.max_columns:int = DEFAULT_MAX_COLUMNS
        self.consistency:SpriteConsistency = DEFAULT_SPRITE_CONSISTENCY
        self.align:SpriteAlign = DEFAULT_SPRITE_ALIGN
        self.label_show_frame_count:bool = DEFAULT_LABEL_SHOW_FRAME_COUNT
        self.label_show_row_size:bool = DEFAULT_LABEL_SHOW_ROW_SIZE
        self.image_margin:int = DEFAULT_IMAGE_MARGIN
        self.row_margin:int = DEFAULT_ROW_MARGIN
        self.sub_row_margin:int = DEFAULT_SUB_ROW_MARGIN
        
        
        # Internal Properties
        self.label_font = None
        self.label_width:int = 0
        self.label_height:int = 0
        self.label_offset:tuple[int, int] = (0, 0)
        self.img_accum_width:int = 0  
        self.img_widest:int = 0
        self.img_tallest:int = 0
class AssembleParam:
    def __init__(self):
        self.background_color:tuple = (0.0, 0.0, 0.0, 0.0)  # RGBA normalized 0 to 1
        self.surrounding_margin:tuple[int, int, int, int] = (15, 15, 15, 15)  # top, right, bottom, left
        self.combine_mode:CombineMode = CombineMode.SHEET


# Utility Methods
def flip_image(image_path:str, flip_h:bool, flip_v:bool):

    # Warn and return if image path is invalid
    if not os.path.exists(image_path):
        log(f"Invalid image path '{image_path}' provided to flip_image", True, "ERROR")
        return


    # Flip horizontally and or vertically based on given flags
    img = Image.open(image_path)
    if(flip_h):
        img = img.transpose(Image.FLIP_LEFT_RIGHT)
    if(flip_v):
        img = img.transpose(Image.FLIP_TOP_BOTTOM)


    # Save flipped image back to same path
    img.save(image_path)
def unique_path(target_path:str, count_limit:int = 100000):

    # Return if path already doesn't exists
    if not os.path.exists(target_path):
        return target_path

    
    # Get essentials
    parent_dir, name = os.path.split(target_path)
    base_name, ext = os.path.splitext(name)


    # Keep changing prefix until path doesn't exist
    counter = 1
    while os.path.exists(target_path) and counter < count_limit:
        new_name = f"{base_name}_{counter}{ext}"
        target_path = os.path.join(parent_dir, new_name)
        counter += 1
    

    return target_path
def create_folder(at_path, folder_name=""):

    # Make sure the name is safe for folder creation
    folder_path = os.path.join(at_path, folder_name)
    folder_path = unique_path(folder_path)


    # Create folder
    if(not os.path.exists(folder_path)):
        os.makedirs(folder_path)


    return folder_path
def color_to_pil(color, mode):

    # Warn and fallback if color data is invalid
    if color is None or len(color) < 3:
        log("Invalid color provided to color_to_pil, falling back to black", True, "ERROR")
        return (0, 0, 0, 0) if mode == "RGBA" else (0, 0, 0)


    # Convert normalized 0 to 1 channels into 0 to 255 int values
    r = int(round(color[0] * PIL_MAX_CHANNEL_VALUE))
    g = int(round(color[1] * PIL_MAX_CHANNEL_VALUE))
    b = int(round(color[2] * PIL_MAX_CHANNEL_VALUE))
    a = int(round(color[3] * PIL_MAX_CHANNEL_VALUE)) if len(color) > 3 else DEFAULT_ALPHA_CHANNEL_VALUE

    return (r, g, b, a) if mode == "RGBA" else (r, g, b)
def alpha_paste(base_img, src_img, position):

    # Simple paste if source has no alpha channel to blend
    if src_img.mode != DEFAULT_COLOR_MODE:
        base_img.paste(src_img, position)
        return


    # Warn and fallback if base has no alpha channel to composite into
    if base_img.mode != DEFAULT_COLOR_MODE:
        log("Base image is not RGBA, alpha compositing skipped, pasting directly instead", True, "ERROR")
        base_img.paste(src_img, position, src_img)
        return


    # Properly alpha composite source onto base at given position
    base_img.alpha_composite(src_img, dest=position)
def has_valid_label(row_data: RowData):
    return row_data.label_font_size != 0 and row_data.label_text != ""
def split_into_sub_rows(images, max_columns):

    # Return single sub row containing all images if no column limit set
    if max_columns <= 0 or len(images) == 0:
        return [images]
    

    # Split images into sub rows of max_columns size each
    sub_rows = []
    for i in range(0, len(images), max_columns):
        sub_rows.append(images[i:i + max_columns])

    return sub_rows
def calc_align_offset(align:SpriteAlign, large_width:int, large_height:int, small_width:int, small_height:int):

    x_offset = 0.0
    y_offset = 0.0


    # Get X Offset
    if(align in [SpriteAlign.TOP_LEFT, SpriteAlign.MIDDLE_LEFT, SpriteAlign.BOTTOM_LEFT]):
        x_offset = 0.0
    elif(align in [SpriteAlign.TOP_CENTER, SpriteAlign.MIDDLE_CENTER, SpriteAlign.BOTTOM_CENTER]):
        x_offset = (large_width - small_width) / 2.0
    elif(align in [SpriteAlign.TOP_RIGHT, SpriteAlign.MIDDLE_RIGHT, SpriteAlign.BOTTOM_RIGHT]):
        x_offset = (large_width - small_width)
    

    # Get Y Offset
    if(align in [SpriteAlign.TOP_LEFT, SpriteAlign.TOP_CENTER, SpriteAlign.TOP_RIGHT]):
        y_offset = 0.0
    elif(align in [SpriteAlign.MIDDLE_LEFT, SpriteAlign.MIDDLE_CENTER, SpriteAlign.MIDDLE_RIGHT]):
        y_offset = (large_height - small_height) / 2.0
    elif(align in [SpriteAlign.BOTTOM_LEFT, SpriteAlign.BOTTOM_CENTER, SpriteAlign.BOTTOM_RIGHT]):
        y_offset = (large_height - small_height)


    return int(x_offset), int(y_offset)
def calc_sub_row_tallest(sub_row_images:list):

    # Warn and return 0 if sub row is empty
    if len(sub_row_images) == 0:
        return 0


    return max(img.height for img in sub_row_images)
def calc_sub_row_size(row_data:RowData, sub_row_images:list, global_img_widest:int, global_img_tallest:int):

    if(row_data.consistency == SpriteConsistency.ALL):
        return global_img_widest * len(sub_row_images), global_img_tallest
    
    if(row_data.consistency == SpriteConsistency.ROW):
        return row_data.img_widest * len(sub_row_images), row_data.img_tallest

    if(row_data.consistency == SpriteConsistency.INDIVIDUAL):
        sub_row_width = sum(img.width for img in sub_row_images)
        sub_row_tallest = calc_sub_row_tallest(sub_row_images)
        return sub_row_width, sub_row_tallest

    return 0, 0
def calc_cell_size(row_data:RowData, img, global_img_widest:int, global_img_tallest:int, sub_row_tallest:int):

    if(row_data.consistency == SpriteConsistency.ALL):
        return global_img_widest, global_img_tallest

    if(row_data.consistency == SpriteConsistency.ROW):
        return row_data.img_widest, row_data.img_tallest

    if(row_data.consistency == SpriteConsistency.INDIVIDUAL):
        return img.width, sub_row_tallest

    return 0, 0
def calc_sub_row_height(row_data:RowData, sub_row_images:list, global_img_tallest:int):

    if(row_data.consistency == SpriteConsistency.ALL):
        return global_img_tallest

    if(row_data.consistency == SpriteConsistency.ROW):
        return row_data.img_tallest

    if(row_data.consistency == SpriteConsistency.INDIVIDUAL):
        return max(img.height for img in sub_row_images) if len(sub_row_images) != 0 else 0

    return 0
def save_row_settings(row_dir, settings:dict):

    # Warn and return if row dir is invalid
    if not os.path.exists(row_dir):
        log(f"Invalid row dir '{row_dir}' provided to save_row_settings", True, "ERROR")
        return


    # Save row settings as json file inside row folder so combine step works standalone
    settings_path = os.path.join(row_dir, ROW_SETTINGS_FILE_NAME)
    with open(settings_path, 'w') as file:
        json.dump(settings, file, indent=4)
def load_row_settings(row_dir):

    # Return empty dict if settings file missing, callers fallback to defaults
    settings_path = os.path.join(row_dir, ROW_SETTINGS_FILE_NAME)
    if not os.path.exists(settings_path):
        log(f"Row settings file not found at '{settings_path}' falling back to defaults")
        return {}


    # Load row settings from json file
    with open(settings_path, 'r') as file:
        return json.load(file)
def create_row_data(label, images, row_settings):

    # Create row data
    row_data = RowData()
    row_data.label_text = label
    row_data.label_font_size = row_settings.get("label_font_size", DEFAULT_FONT_SIZE)
    row_data.label_color = tuple(row_settings.get("label_color", DEFAULT_LABEL_COLOR))
    row_data.label_margin = row_settings.get("label_margin", DEFAULT_LABEL_MARGIN)
    row_data.image_margin = row_settings.get("image_margin", DEFAULT_IMAGE_MARGIN)
    row_data.row_margin = row_settings.get("row_margin", DEFAULT_ROW_MARGIN)
    row_data.sub_row_margin = row_settings.get("sub_row_margin", DEFAULT_SUB_ROW_MARGIN)
    row_data.consistency = SpriteConsistency(row_settings.get("sprite_consistency", DEFAULT_SPRITE_CONSISTENCY.value))
    row_data.align = SpriteAlign(row_settings.get("sprite_align", DEFAULT_SPRITE_ALIGN.value))
    row_data.label_show_frame_count = row_settings.get("label_show_frame_count", DEFAULT_LABEL_SHOW_FRAME_COUNT)
    row_data.label_show_row_size = row_settings.get("label_show_row_size", DEFAULT_LABEL_SHOW_ROW_SIZE)
    row_data.max_columns = row_settings.get("max_columns", DEFAULT_MAX_COLUMNS)
    row_data.images = split_into_sub_rows(images, row_data.max_columns)


    # Add accumulated width, widest img width & tallest img height to row data
    for img in images:
        row_data.img_accum_width += img.width
        row_data.img_widest = max(row_data.img_widest, img.width)
        row_data.img_tallest = max(row_data.img_tallest, img.height)


    return row_data


# Methods
def combine_into_images(param:AssembleParam, rows:list[RowData], global_img_widest:int, global_img_tallest:int, output_path:str):
    
    # Extract from param
    surrounding_margin_top = param.surrounding_margin[0]
    surrounding_margin_right = param.surrounding_margin[1]
    surrounding_margin_bottom = param.surrounding_margin[2]
    surrounding_margin_left = param.surrounding_margin[3]

    
    # Make sure folder exists
    create_folder(output_path)


    # Iterate and create images
    for row_count, row_data in enumerate(rows):

        # Create row folder
        row_folder = os.path.join(output_path, f"{row_count}_{row_data.label_text}")
        create_folder(row_folder)
        log(f"Row '{row_data.label_text}' folder created at '{row_folder}'")


        # Flatten sub rows back into a single ordered list of images
        flat_images = [img for sub_row in row_data.images for img in sub_row]


        # Save images
        for img_count, img in enumerate(flat_images):

            # Get cell size
            large_width, large_height = img.width, img.height
            if(row_data.consistency == SpriteConsistency.ROW):
                large_width, large_height = row_data.img_widest, row_data.img_tallest
            elif(row_data.consistency == SpriteConsistency.ALL):
                large_width, large_height = global_img_widest, global_img_tallest
            

            # Add margins
            new_img_width = surrounding_margin_left + large_width + surrounding_margin_right
            new_img_height = surrounding_margin_top + large_height + surrounding_margin_bottom


            # Create new image
            log(f"Creating image {new_img_width}x{new_img_height}")
            bg_color = color_to_pil(param.background_color, img.mode)
            new_img = Image.new(img.mode, (int(new_img_width), int(new_img_height)), bg_color)
            

            # Calculate offset based on alignment & consistency
            offset_x, offset_y = calc_align_offset(row_data.align, large_width, large_height, img.width, img.height)


            # Paste image
            alpha_paste(new_img, img, (int(offset_x + surrounding_margin_left), int(offset_y + surrounding_margin_top)))


            # Build size postfix if enabled
            size_postfix = f" ({new_img_width} x {new_img_height})" if row_data.label_show_row_size else ""


            # Save new image
            ext = img.format if img.format is not None else DEFAULT_FILE_FORMAT
            img_output_path = os.path.join(row_folder, f"{img_count}{size_postfix}.{ext.lower()}")
            log(f"Saving image to '{img_output_path}' ...")
            new_img.save(img_output_path)
            log(f"Successfully saved sprite image to {img_output_path}")
def combine_into_strips(param:AssembleParam, rows:list[RowData], global_img_widest:int, global_img_tallest:int, output_path:str):
    
    # Make sure folder exists
    create_folder(output_path)


    # Iterate and create one strip per group
    for row in rows:
        has_images = len(row.images) != 0 and len(row.images[0]) != 0
        ext = row.images[0][0].format if has_images else DEFAULT_FILE_FORMAT
        strip_output_path = os.path.join(output_path, f"{row.label_text}.{ext.lower()}")
        combine_into_sheet(param, [row], global_img_widest, global_img_tallest, strip_output_path)
def combine_into_sheet(param:AssembleParam, rows:list[RowData], global_img_widest:int, global_img_tallest:int, output_path:str):

    # Extract from param
    surrounding_margin = param.surrounding_margin


    # Assign prerequisites & Calculate sheet dimensions
    sheet_width = 0
    sheet_height = 0
    for row_count, row_data in enumerate(rows):

        # Calculate combined content width & height of all sub rows
        content_width:int = 0
        content_height:int = 0
        widest_index = -1
        for i, sub_row_images in enumerate(row_data.images):

            # Increase content height
            sub_row_width, sub_row_height = calc_sub_row_size(row_data, sub_row_images, global_img_widest, global_img_tallest)
            content_height += sub_row_height

            # Store widest sub row index
            if sub_row_width > content_width:
                content_width = sub_row_width
                widest_index = i


        # Calculate content margins
        sub_row_h_margin = row_data.image_margin * (len(row_data.images[widest_index]) - 1) if widest_index != -1 else 0
        sub_row_v_margin = row_data.sub_row_margin * (len(row_data.images) - 1) if len(row_data.images) != 0 else 0
        row_v_margin = row_data.row_margin if row_count + 1 < len(rows) else 0


        # Add label postfix
        if row_data.label_show_frame_count:  # Add frame count in label
            total_img_count = sum(len(sub_row) for sub_row in row_data.images)
            row_data.label_text += f" [{total_img_count}]"
        if row_data.label_show_row_size:  # Add row size in label
            row_data.label_text += f" ({content_width + sub_row_h_margin} x {content_height + sub_row_v_margin})"


        # Add label font
        row_data.label_font = ImageFont.load_default(row_data.label_font_size) if row_data.label_font_size != 0 else None


        # Calculate label height & width
        has_label:bool = has_valid_label(row_data)
        label_bbox = (0, 0, 0, 0) if not has_label else row_data.label_font.getbbox(row_data.label_text)
        row_data.label_width = (label_bbox[2] - label_bbox[0])
        row_data.label_height = (label_bbox[3] - label_bbox[1])
        row_data.label_offset = (0, -label_bbox[1])

        
        # Calculate label margins
        label_v_margin = row_data.label_margin if has_label else 0
        

        # Add to total sheet height & width
        sheet_width = max(sheet_width, content_width + sub_row_h_margin, row_data.label_width)
        sheet_height += (content_height + row_v_margin + sub_row_v_margin) + (row_data.label_height + label_v_margin)


    # Add surrounding margins to sheet dimensions
    sheet_width += surrounding_margin[1] + surrounding_margin[3]
    sheet_height += surrounding_margin[0] + surrounding_margin[2]


    # Create sheet
    log(f"Creating sprite sheet {sheet_width}x{sheet_height}")
    has_images = len(rows[0].images) != 0 and len(rows[0].images[0]) != 0
    img_mode = rows[0].images[0][0].mode if has_images else DEFAULT_COLOR_MODE
    bg_color = color_to_pil(param.background_color, img_mode)
    sheet = Image.new(img_mode, (int(sheet_width), int(sheet_height)), bg_color)
    draw = ImageDraw.Draw(sheet)


    # Paste labels & images into sheet
    paste_height = surrounding_margin[0]
    for row_count, row_data in enumerate(rows):

        # Paste label
        if(has_valid_label(row_data)):
            label_location_x = surrounding_margin[3] + row_data.label_offset[0]
            label_location_y = paste_height + row_data.label_offset[1]
            label_fill = color_to_pil(row_data.label_color, img_mode)
            draw.text((label_location_x, label_location_y), row_data.label_text, fill=label_fill, font=row_data.label_font, spacing=0)
            paste_height += row_data.label_height + row_data.label_margin
            log(f"Addded label '{row_data.label_text}' at ({label_location_x},{label_location_y})")


        # Iterate through images
        flat_images = [img for sub_row in row_data.images for img in sub_row]
        max_columns = row_data.max_columns if row_data.max_columns > 0 else len(flat_images)
        sub_row_height = calc_sub_row_height(row_data, row_data.images[0], global_img_tallest)
        paste_width = surrounding_margin[3]
        for i, img in enumerate(flat_images):

            # New sub row after max columns reached
            if i != 0 and i % max_columns == 0:
                paste_height += sub_row_height + row_data.sub_row_margin
                paste_width = surrounding_margin[3]
                sub_row_height = calc_sub_row_height(row_data, row_data.images[i // max_columns], global_img_tallest)

            # Paste image
            large_width, large_height = calc_cell_size(row_data, img, global_img_widest, global_img_tallest, sub_row_height)
            offset_x, offset_y = calc_align_offset(row_data.align, large_width, large_height, img.width, img.height)
            img_location_x, img_location_y = paste_width + offset_x, paste_height + offset_y
            alpha_paste(sheet, img, (int(img_location_x), int(img_location_y)))
            paste_width += large_width + row_data.image_margin
            log(f"Added image of frame {i} at ({img_location_x},{img_location_y})")


        # Add last sub row height
        if len(flat_images) > 0:
            paste_height += sub_row_height


        # Add row margin
        if row_count + 1 < len(rows):
            paste_height += row_data.row_margin
    

    # Save the final output sprite sheet
    log(f"Saving sprite sheet to '{output_path}' ...")
    sheet.save(output_path)
    log(f"Successfully saved sprite sheet to {output_path}")
def assemble_images(param:AssembleParam, input_folder_path:str, output_path:str):

    # Get all sorted action sub folders
    action_folders = sorted(
        [folder for folder in os.listdir(input_folder_path) if os.path.isdir(os.path.join(input_folder_path, folder))],
        key=lambda x: int(x.split('_')[0])
    )
    log(f"Found {len(action_folders)} action sub folders")


    # Create row data from folders 
    global_img_widest:int = 0
    global_img_tallest:int = 0
    rows:list[RowData] = []
    for action_folder in action_folders:

        # Get row label name
        label_text = action_folder.split('_', 1)[1]


        # Get row settings
        abs_action_folder = os.path.join(input_folder_path, action_folder)
        row_settings = load_row_settings(abs_action_folder)


        # Get images
        img_names = [name for name in os.listdir(abs_action_folder) if name != ROW_SETTINGS_FILE_NAME]
        img_names = sorted(img_names, key=lambda x: int(x.split('.')[0]))
        images = [Image.open(os.path.join(abs_action_folder, name)) for name in img_names]


        # Create row data
        row_data = create_row_data(label_text, images, row_settings)
        rows.append(row_data)


        # Store global widest and tallest images
        global_img_widest = max(global_img_widest, row_data.img_widest)
        global_img_tallest = max(global_img_tallest, row_data.img_tallest)


    # Combine into sheet or strips 
    if(param.combine_mode == CombineMode.SHEET):
        combine_into_sheet(param, rows, global_img_widest, global_img_tallest, output_path)
    elif(param.combine_mode == CombineMode.STRIPS):
        combine_into_strips(param, rows, global_img_widest, global_img_tallest, output_path)
    elif(param.combine_mode == CombineMode.IMAGES):
        combine_into_images(param, rows, global_img_widest, global_img_tallest, output_path)
