/* MONSTERCOMP:  PATHFINDER STAT BLOCK> COMPENDIUM BLOCK IMPORTER FOR ROLL20 API
Author Keryn.W 2019
Version 1.0

I heavily cannibalized Jason.W's 2015 script "PathfinderImporter" to create this. 
This script will take a block of Pathfinder stats (i.e. from d20pfsrd) and 
load it into the Monster Stat Block of the Community sheet, then the user lets the 
built-in parser do most of the work. 

This script currently works for:
    
    D20PFSRD - http://www.d20pfsrd.com/

**********************************************************************************
Before using this script:

    This script is not intended to work for NPCs with class levels.

    This script is SUPER finicky about data format.  I'm working to relieve that as I find monsters that it can't work with.

To use this script:

    1   Use any token uploaded to your personal token library (will usually not work with things not uploaded i.e. marketplace tokens )
    2   Name this token MonsterComp
    3   Copy the statblock "MonsterComp"'s GMnotes section AS PLAIN TEXT (cannot stress this part enough)
    3.5 Go through and verify that there is one hard return after every section of data (multi-line descriptions are exempt from this, 
        although they do need to be separate from OTHER types of data by a genuine space)
    4   Select the Monstercomp token and type !MonsterComp into the chat entry box
    5   Open the character sheet and hit the Parse button.
    6   You should have a functional character sheet now!
    
    If you got malformed results for something without class level: 
        First suspect that the text in GMNotes is not properly text-only. 
        THEN suspect you got it in a format/order that MonsterComp isn't familiar with
        
        
*/

var RegExpEscapeSpecial = /([\/\\\/\[\]\(\)\{\}\?\+\*\|\.\^\$])/g;


var AddAttribute = AddAttribute || {};
function AddAttribute(attr, value, charID) {
    //log("Creating attribute " + attr + " " + value);
    if (value === undefined) {
        log("AddAttribute: " + attr + " has returned an undefined value.");
    }
    else {
        createObj("attribute", {
            name: attr,
            current: value,
            characterid: charID
        });
        //log("AddAttribute: " + attr + "." + value); //for diagnostics!
        return;
    }
}

function stripString(str, removeStr, replaceWith) {
    //var r = new RegExp(removeStr.replace(RegExpEscapeSpecial, "\\$1"), 'g');
    var r = str.replace(removeStr, replaceWith);
    return str.replace(r, replaceWith);
}

/*Cleans up the string leaving text and hyperlinks */
function cleanUpString(strSpecials) {
    strSpecials = stripString(strSpecials, "%20", " ");
    strSpecials = stripString(strSpecials, "%22", "\"");
    strSpecials = stripString(strSpecials, "%29", ")");
    strSpecials = stripString(strSpecials, "%28", "(");
    strSpecials = stripString(strSpecials, "%2C", ",");
    strSpecials = stripString(strSpecials, "%26nbsp", " "); //nonbreaking space

    var inParens = 0;
    for (var i = 0; i < strSpecials.length; i++) {
        if (strSpecials[i] === "(")
            inParens++;
        if (strSpecials[i] === ")")
            inParens--;

        if ((inParens > 0) && (strSpecials[i] === ",")) {
            var post = strSpecials.slice(i);
            strSpecials = strSpecials.replace(post, "");
            post = post.replace(",", " ");

            strSpecials = strSpecials + post;
        }

    }

    strSpecials = stripString(strSpecials, "%3C", "<");
    strSpecials = stripString(strSpecials, "%3E", ">");
    strSpecials = stripString(strSpecials, "%23", "#");
    strSpecials = stripString(strSpecials, "%3A", ":");
    strSpecials = stripString(strSpecials, "%3B", ",");
    strSpecials = stripString(strSpecials, "%3D", "=");

    strSpecials = stripString(strSpecials, "</strong>", "");
    strSpecials = stripString(strSpecials, "<strong>", "");
    strSpecials = stripString(strSpecials, "</em>", "");
    strSpecials = stripString(strSpecials, "<em>", "");
    strSpecials = stripString(strSpecials, "%u2013", "-");
    strSpecials = stripString(strSpecials, "%u2014", "—");
    strSpecials = stripString(strSpecials, "%u2019", "\'");    
    strSpecials = stripStringRegEx(strSpecials, "<b", ">");
    strSpecials = stripString(strSpecials, "</b>", "");
    strSpecials = stripStringRegEx(strSpecials, "<h", ">");
    strSpecials = stripStringRegEx(strSpecials, "</h", ">");

    strSpecials = stripString(strSpecials, "</a>", "");
    
    //strSpecials = stripString(strSpecials, "<p>", "");
    //strSpecials = stripString(strSpecials, "</p>", "");

    strSpecials = stripStringRegEx(strSpecials, "<t", ">");
    strSpecials = stripStringRegEx(strSpecials, "</t", ">");

    while (strSpecials.search(/%../) != -1) {
        strSpecials = strSpecials.replace(/%../, "");
    }

    return strSpecials;
}

/* Deletes any characters between the character a and b in incstr */
function stripStringRegEx(incstr, a, b) {
    var ea = a.replace(RegExpEscapeSpecial, "\\$1"),
        eb = b.replace(RegExpEscapeSpecial, "\\$1"),
        r = new RegExp(ea + '.*?' + eb, 'g');
    return incstr.replace(r, '');
}

/* Deletes the links from the string str */
function removeLinks(str) {
    return stripStringRegEx(str, "<", ">");
}

//looks for an occurrence of str in the array strArray, if found returns that element
// on doConcat, strips a trailing "and" and concatenates with the next line.
function findString(strArray, str, doConcat) {
    var retr,
    r = new RegExp(str.replace(RegExpEscapeSpecial, "\\$1"));
    _.find(strArray, function(v, k, l) {
        if (v.match(r)) {
            retr = v;
            if (doConcat && v.match(/and$/) && l[k + 1]) {
                retr = retr.replace(/and$/, '') + ', ' + l[k + 1];
            }
            return true;
        }
        return false;
    });
    return retr;
};

// returns the string between two characters a/b 
function getSubStr(str, a, b) {
    var ea = a.replace(RegExpEscapeSpecial, "\\$1"),
        eb = b.replace(RegExpEscapeSpecial, "\\$1"),
        r = new RegExp(ea + '(.*?)' + eb),
        m = str.match(r);
    return m && m[1];
};

//******************************************************************************

on('chat:message', function(msg) {

    // Only run when message is an api type and contains "!MonsterComp"
    if (msg.type == 'api' && msg.content.indexOf('!MonsterComp') !== -1) {

        if (!(msg.selected && msg.selected.length > 0)) return; // Make sure there's a selected object

        var token = getObj('graphic', msg.selected[0]._id);
        if (token.get('subtype') != 'token') return; // Don't try to set the light radius of a drawing or card


        //*************  START CREATING CHARACTER****************
        // get notes from token
        var originalGmNotes = token.get('gmnotes');  // we don't really do anything with this, too messy to put anywhere
        var gmNotes = token.get('gmnotes');

        //strip string with function
        gmNotes = stripString(gmNotes, "%3C/table%3E", "%3Cbr");
        gmNotes = stripString(gmNotes, "%3C/h1%3E", "%3Cbr");
        gmNotes = stripString(gmNotes, "%3C/h2%3E", "%3Cbr");
        gmNotes = stripString(gmNotes, "%3C/h3%3E", "%3Cbr");
        gmNotes = stripString(gmNotes, "%3C/h4%3E", "%3Cbr");
        
        // this next part is meant to insert a break where there needs to be one
        var paramissingbr = "%3C/p%3E%3Cp%3E" // "</p><p>"
        var parawithbr = "%3C/p%3E%3Cp%3E%3Cbr%3E%3C/p%3E%3Cp%3E" // </p><br><p>
        gmNotes = stripString(gmNotes, paramissingbr, parawithbr); 
        //  It does what I want, but I think something about this crashes somethingg?
        
        //log(gmNotes);

        //break the string down by line returns
        var data = gmNotes.split("%3Cbr");

        //log(data);

        //clean any characters excepting text and hyperlinks
        for (var i = 0; i < data.length; i++) {
            data[i] = cleanUpString(data[i]);
            data[i] = removeLinks(data[i]);
            if (data[i][0] === ">") {
                data[i] = data[i].replace(">", "");
            }
        }

        for (var i = 0; i < data.length; i++) {
            if (data[i] !== null) {
                data[i] = data[i].trim();
            }
        }

        //log(data);

        var nameLine = findString(data, "CR ", true);
        nameLine = nameLine.trim();
        nameLine = nameLine.split("CR "); 
        var charName = nameLine[0];

        // check if the character entry already exists, if so error and exit.
        var CheckSheet = findObjs({
            _type: "character",
            name: charName,
        });

        if (CheckSheet.length > 0) {
            sendChat("ERROR", "This character already exists.");
            return;
        }

        //Create character entry in journal, assign token
        var character = createObj("character", {
            name: charName
        });

        var charID = character.get('_id');

        //set is_npc, sheet background, and hide configuration
        AddAttribute("is_npc",1,charID);
        AddAttribute("use_background",2,charID);
        AddAttribute("config-show",0,charID);

        //Determine and enter CR
        var tokenName = charName;
        var CR = nameLine[1];
        AddAttribute("cr_compendium", CR, charID);

        //split and enter XP
        var xpHeader = findString(data, "XP ", true);
        xpHeader = xpHeader.split("XP ");
        var XP = xpHeader[1];
        AddAttribute("xp_compendium", XP, charID);

//******************************************************************************
        // alignment, size_compendium, type_compendium   
        
        // array of possible sizes to use to search 

        // change this to start from the top and find the FIRST occurrence of a size category and use that.
        // because ability descriptions can also contain size categories
        
        var sizesWithSpace = "Fine ,Diminutive ,Tiny ,Small ,Medium ,Large ,Huge ,Gargantuan ,Colossal ";
        var sizesArray = sizesWithSpace.split(",");

        for (var i = 0; i < 9; i++) {
            if (findString(data, sizesArray[i], true) !== undefined) {
                var sizeLine = findString(data, sizesArray[i], true);
                break;
            }
        }

        //get subtype before destroying string
        var subType = getSubStr(sizeLine, "(", ")");
    
        //remove the brackets and anything between them, trim the string,
        //create the array split at spaces, then assign the alignment to the sheet.
        var typeArray = stripStringRegEx(sizeLine, "(", ")");
        typeArray = typeArray.trim();
        typeArray = typeArray.split(" ");

        sizeLine = sizeLine.split(" ");
        AddAttribute("alignment", sizeLine[0], charID);
        AddAttribute("size_compendium", sizeLine[1], charID);

        // concatenate type and subtype to put into the text box

        if (subType != null) {
            var bothTypes = typeArray[2].concat(" (", subType, ")");
        }
        else {
            var bothTypes = typeArray[2];
        }
        AddAttribute("type_compendium", bothTypes, charID);

//******************************************************************************
        // class_compendium (leave blank)
        
//******************************************************************************
        // init_compendium (alignment size type init)
        
        var initHold = sizeLine[0] + " "  + sizeLine[1] + " " + bothTypes + " ";
        var initLine = findString(data, "Init ", true);            // init line contains senses and perception too

        initArray = initLine.split(", ");

        initiative = initHold + initArray[0]; 

        AddAttribute("init_compendium", initiative, charID);
        
//******************************************************************************
        // senses_compendium  (senses & perception separated by "; ")

        var senseLine = initLine.split("Senses ");
        
        senseLine[1] = senseLine[1].replace(", Perception", "; Perception");
        var senseArray = senseLine[1].split("Aura");        
        senseArray[0] = senseArray[0].replace(", ", " ");

        AddAttribute("senses_compendium", senseArray[0], charID);

//******************************************************************************
        // npc-aura
        if (senseArray[1] !== undefined) {
            AddAttribute("npc-aura", senseArray[1], charID);
        }
//******************************************************************************
        // ac_compendium
        
        var acLine = findString(data, "AC ", true);
        acLine = acLine.split("AC ");

        AddAttribute("ac_compendium", acLine[1], charID);    

//******************************************************************************
        // npc_hp_compendium
        var hpLine = findString(data, "hp ", true);
       
        AddAttribute("npc_hp_compendium", hpLine, charID); 

//******************************************************************************
        // fort_compendium,ref_compendium,will_compendium,save-notes
        var savesLine = findString(data, "Fort ", true);
        var savesArray = savesLine.split(" ");

        var fortitude = savesArray[1].replace(",", "");
        var reflex = savesArray[3].replace(",", "");
        var willpower = savesArray[5].replace(",", "");

        var savesArrayExtra = savesLine.split(",");
        savesArrayExtra.splice(0, 3);

        AddAttribute("fort_compendium", fortitude, charID);
        AddAttribute("ref_compendium", reflex, charID);
        AddAttribute("will_compendium", willpower, charID);
        if (savesArrayExtra !== undefined) {
            AddAttribute("Save-notes", savesArrayExtra, charID);
        }
//******************************************************************************
        // dr_compendium
        var drLine = findString(data, "DR ", true);

        if (drLine !== undefined) {
            var damageResist = drLine.split(", ");
            AddAttribute("dr_compendium", damageResist[0], charID);
        }
 
//******************************************************************************
        // immunities
        var immuneLine = findString(data, "Immune ", true);
        if (immuneLine !== undefined) {
            var immuneTemp = immuneLine.split("Immune ");
        //  lots of stuff may or may not come after Immunities, so we need to divide it a few times to be sure we got it all    
            var immuneRes = immuneTemp[1].split("Resist ");
            var immuneSR = immuneRes[0].split("SR ");
            var immuneWeak = immuneSR[0].split("Weaknesses ");
            var immunities = immuneWeak[0];
            AddAttribute("immunities", immunities, charID);
        }
        
//******************************************************************************
        // resistances
        var resLine = findString(data, "Resist ", true);
        if (resLine !== undefined) {
            resLine = resLine.split("Resist ");
            var resSR = resLine[1].split("SR ");   
            var resWeak = resSR[0].split("Weaknesses ");
            resistance = resWeak[0];
            AddAttribute("resistances", resistance, charID);
        }
        
//******************************************************************************
        // sr_compendium
        var srLine = findString(data, "SR ", true);
        if (srLine !== undefined) {
            srLine = srLine.split("SR ");
            var spellRes = srLine[1].split("Weaknesses ");
            srFinal = spellRes[0]
            AddAttribute("sr_compendium", srFinal, charID);
        }
        
//******************************************************************************
        // weakenesses
        var weakLine = findString(data, "Weaknesses ", true);
        if (weakLine !== undefined) {
            weakLine = weakLine.split("Weaknesses ");
            AddAttribute("weaknesses", weakLine[1], charID);
        }
            

//******************************************************************************
        // npc-defensive-abilities
        var defenseLine = findString(data, "Defensive Abilities", true);
        if (defenseLine !== undefined) {
            defenseLine = defenseLine.replace("Defensive Abilities ", "");
            AddAttribute("npc-defensive-abilities", defenseLine, charID);
        }        

//******************************************************************************
        // speed_compendium
        var speedStr = findString(data, "Speed ", true);

        if (speedStr !== undefined) {
            speedStr = speedStr.replace("Speed ", "");
            AddAttribute("speed_compendium", speedStr, charID);
        }
        
//******************************************************************************
        // space_compendium, reach_compendium, reach-notes

         // find line containing "Space"
        var space = "",
        reach = "";

        var reachLine = findString(data, "Space ", true);

        if (reachLine !== undefined) {
            //get notes before destroying string
            var reachNotes = getSubStr(reachLine, "(", ")");
            var reachArray = stripStringRegEx(reachLine, "(", ")");
            var reachNums = reachArray.split(",");
            space = reachNums[0];
            reach = reachNums[1];

            AddAttribute("reach-notes", reachNotes, charID);
        }
        else {
            space = 5
            reach = 5
        }
        AddAttribute("space_compendium", space, charID);
        AddAttribute("reach_compendium", reach, charID);

//******************************************************************************
        // npc-melee-attacks-text
        
        // here, add a way to parse the verbiage of the data from Dingles into a proper string for the compendium.
        
        var meleeLine = findString(data, "Melee ", true);
        if (meleeLine !== undefined) {
            meleeLine = meleeLine.replace("Melee ", "");
            AddAttribute("npc-melee-attacks-text", meleeLine, charID);
        }        

//******************************************************************************
        // npc-ranged-attacks-text
        
        var rangeLine = findString(data, "Ranged ", true);
        if (rangeLine !== undefined) {
            rangeLine = rangeLine.replace("Ranged ", "");
            AddAttribute("npc-ranged-attacks-text", meleeLine, charID);
        }        

//******************************************************************************
        // npc-special-attacks
        var specAtks = findString(data, "Special Attacks ", true);
        if (specAtks !== undefined) {
            specAtks = specAtks.replace("Special Attacks ", "");
            AddAttribute("npc-special-attacks", specAtks, charID);
        }
        
//******************************************************************************
        // spellike-ability-text, npc-spells-known-text
        var spellikeLine = findString(data, "Spell-Like Abilities ", true);
        var spellikeNum = data.indexOf(spellikeLine);
        var spellsknownLine = findString(data, "Spells Known ", true);
        var spellsknownNum = data.indexOf(spellsknownLine);

        if (spellikeLine !== undefined) {
            if (spellsknownLine !== undefined) {
                var endNumber = spellsknownNum;
            }
            else {
                var endNumber = data.indexOf("STATISTICS");
            }
            var spellikeStr = ""
            for (i = spellikeNum; i < endNumber; i++) {
                spellikeStr = spellikeStr + data[i] + String.fromCharCode(13);
            }
            AddAttribute("npc-spellike-ability-text", spellikeStr, charID);
        }

        if (spellsknownLine !== undefined) {
            var endNumber = data.indexOf("STATISTICS");
            var spellsStr = ""

            for (i = spellsknownNum; i < endNumber; i++) {
                spellsStr = spellsStr + data[i] + String.fromCharCode(13);
            }
            AddAttribute("npc-spells-known-text", spellsStr, charID);
        }

//******************************************************************************
        // str_compendium, dex_compendium,con_compendium,int_compendium,wis_compendium,cha_compendium
        
        //find the element in the data array that the title "Statistics" occurs in
        var statsElementNumber = data.indexOf("STATISTICS");

        //the actual attribute scores are in the element after the heading
        var stats = data[statsElementNumber + 1];
        stats = stats.split(",");

        //assign attribute scores by removing non numerical characters from the stats array elements

        var strength = stats[0].replace(/\D/g, "");
        var dexterity = stats[1].replace(/\D/g, "");
        var constitution = stats[2].replace(/\D/g, "");
        var intelligence = stats[3].replace(/\D/g, "");
        var wisdom = stats[4].replace(/\D/g, "");
        var charisma = stats[5].replace(/\D/g, "");

        // place attribute scores in NPC sheet
        AddAttribute("str_compendium", strength, charID);
        AddAttribute("dex_compendium", dexterity, charID);
        AddAttribute("con_compendium", constitution, charID);
        AddAttribute("int_compendium", intelligence, charID);
        AddAttribute("wis_compendium", wisdom, charID);
        AddAttribute("cha_compendium", charisma, charID);

//******************************************************************************
        // bab_compendium, cmb_compendium, cmd_compendium
        var babArray = findString(data, "Base Atk", true);
        babArray = babArray.split(",");

        babArray[0] = babArray[0].replace("Base Atk ", "");    
        AddAttribute("bab_compendium", babArray[0], charID);

        babArray[1] = babArray[1].replace("CMB ", "");    
        AddAttribute("cmb_compendium", babArray[1], charID);

        babArray[2] = babArray[2].replace("CMD ", "");    
        AddAttribute("cmd_compendium", babArray[2], charID);

//******************************************************************************
        // npc-feats-text
        var feats = findString(data, "Feats ", true);
        if (feats !== undefined) {
            feats = feats.replace("Feats ", "");
            feats = feats.replace("RushB", "Rush"); // d20PFSRD's formating of Bull Rush needs trimming.
            feats = feats.trim();
            AddAttribute("npc-feats-text", feats, charID);
        }
//******************************************************************************
        // skills_compendium, racial_mods_compendium
        var skillsLine = findString(data, "Skills", true);
        if (skillsLine !== undefined) {
            skillsLine = skillsLine.replace("Skills ", "");
            skillsLine = skillsLine.split("Racial Modifiers ");
            AddAttribute("skills_compendium", skillsLine[0], charID);
            if (skillsLine[1] !== undefined) {
                skillsLine[1] = skillsLine[1].replace("Racial Modifiers ", "");
                AddAttribute("racial_mods_compendium", skillsLine[1], charID);
            }
        }
 
//******************************************************************************
        // languages
        var languageStr = findString(data, "Languages", true);
        if (languageStr !== undefined) {
            languageStr = languageStr.replace("Languages ", "");
            AddAttribute("languages", languageStr, charID);
        }
//******************************************************************************
        // SQ_compendium
        var sqStr = findString(data, "SQ ", true);
        if (sqStr !== undefined) {
            sqStr = sqStr.replace("SQ ", "")
            AddAttribute("SQ_compendium", sqStr, charID);
         }

//******************************************************************************
        // environment
        var enviroStr = findString(data, "Environment ", true);
        var enviroNum = data.indexOf(enviroStr);
        if (enviroStr !== undefined) {
            enviroStr = enviroStr.replace("Environment ", "")
            AddAttribute("environment", enviroStr, charID);
        }
//******************************************************************************
        // organization
        var orgStr = findString(data, "Organization ", true);
        var orgNum = data.indexOf(orgStr);
        if (orgStr !== undefined) {
            orgStr = orgStr.replace("Organization ", "")
            AddAttribute("organization", orgStr, charID);
        }

//******************************************************************************
        // other-items-treasure        
        var treasureStr = findString(data, "Treasure ", true);
        var treasureNum = data.indexOf(treasureStr);
        if (treasureStr !== undefined) {
            treasureStr = treasureStr.replace("Treasure ", "")
            AddAttribute("other_items_treasure", treasureStr, charID);
        }
        
//******************************************************************************
        // content_compendium  (special qualities text & decription)        

        // first, find the last line of data prior to the start of the description 
        // it's always the last part of the data, but doesn't have a tag to find.
        var startNum = data.indexOf("ECOLOGY");
        if (treasureNum > startNum) {
            startNum = treasureNum;
        }
        else { 
            if (orgNum > startNum) {
                startNum = orgNum;
            }
            else { 
                if (enviroNum > startNum) {
                    startNum = enviroNum;
                }
            }
        }

        var endNum = data.length;
        var contentLine = "";
        
        for (i = startNum+1; i < endNum; i++) {
            contentLine = contentLine + data[i] + String.fromCharCode(13);
        }

        // the description is added to the character sheet bio
        character.set('bio',contentLine);

        // special abilities are now added to the bottom of description
        // double space after each to try to fix some oddness I found with 
        // one creature.
        
        var startNum = data.indexOf("SPECIAL ABILITIES");
        var endNum = data.indexOf("ECOLOGY");
        
        for (i = startNum+1; i < endNum; i++) {
            contentLine = contentLine + data[i] + String.fromCharCode(13) + String.fromCharCode(13);
        } 
        
        AddAttribute("content_compendium", contentLine, charID);
    }
});