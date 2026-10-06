# Bet City Phase 1

This phase converts the local Godot Night Drop foundation into a Bet City free-roam prototype.

## What changes

- Removes the Night Drop gameplay loop from the active main scene.
- Removes cops, wanted/heat, weapons, shooting, missions and crime reporting from the active game controller.
- Keeps the existing city, traffic, pedestrians, player movement, vehicles, camera and day/night rendering.
- Adds Bet City HUD with a virtual BET wallet.
- Starts the player with 10,000 virtual BET.
- Rebrands the start screen as Bet City.
- Replaces the mobile punch action with no punch action.
- Adds the first Lucky Shop marker.
- Keeps real-money payments and cashout out of the prototype.

## Apply on the phone

From Termux:

    cd ~/Bet-city
    chmod +x tools/apply-bet-city-phase1.sh
    ./tools/apply-bet-city-phase1.sh

Then reopen/reimport the project in Godot 4.7 and press Play.

The script downloads only the Phase 1 files from this repository into the already-cloned local Godot project.
