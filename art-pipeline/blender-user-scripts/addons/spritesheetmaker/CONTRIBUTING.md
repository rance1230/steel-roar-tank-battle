# Contributing

Always make changes in the branch you're contributing for e.g. `5.x`, `4.x`, etc but never modify the `main` branch.  

### Todos
1. Implement a automated testing system
1. <details><summary>Write automated test cases</summary>

    <!-- Button Checks -->
    1. Does `Export` button work?
    2. Does `Import` button work?
    3. Does **Duplicate Row** button work?
    4. Does **Add Row** button work?
    5. Does **Remove Row** button work?
    6. Does **Move Row Up** button work?
    7. Does **Move Row Down** button work?
    8. Does **Play Preview** button work?
    9. Does **Add Capture Item** button work?
    10. Does **Remove Capture Item** button work?
    11. Does `Create Auto Camera`/`Modify Custom Camera` button work?
    12. Does `Pixelate Test Image` button work?
    13. Does `Combine Sprites` button work?
    14. Does `Create Single Sprite` button work?
    15. Does `Create Sprite Images`/`Create Sprite Rows`/`Create Sprite Sheet` button work?
    <!-- Functionality Checks -->
    16. Does an animation with 0 frames give empty row?
    17. Does sprite align work?

    </details>
2. Cross verify and/or improve the code and math behind auto camera calculations.
3. Add a feature to allow external scripts to hook onto certain events in the addon e.g. when the sprite sheet has completed creation, when a single frame has been rendered, when images are about to be stiched together, etc.
