1. Please turn off the feature ending turn after 3 cards played. Let the player end the turn. 
2. Sly card or forced card is taking cards directly without showing player which cards are going. Thogh whoever is giving the card can not do anything but should inform in a modal box that particular card is leaving, so that player acknowldges. 
3. In my play area, I have my cards, but they are overlapped. can't see them, and they are like read only - can't click even. 
4. Can the player boxes be highlighted when turn comes? Currently just showing names
5. When no property or cash on table for a player skip the player awaiting payment. It will be great in awaiting payment should show who is pending. 
6. different colors Cards are getting grouped together.
7. No matter what a complete set can not be broken when paying rent, debt etc. Only Deal breaker card can take the whole set. 


---------
1. If forced deal is played its currently handling worngly. Imagine I swapped a green with blue, in property area its showing the card but in green!! Worth looking prod-server.ts line 422. 
2. When taking rent or asking payment it show all of their cards on table for me to choose. Currently it opens up modal and I can't see what their cards are in the modal. 
3. When deal breaker is played, should show alert like sly deal has. 
4. End turn button & draw card button - I accidentally clicked end and my turn was ended even I played. And the color codes can be different, yellow there isn't visible. May be can have floating buttons without blocking the view, may be can be dragged. 
5. If my turn is not there, the cards a greayed out, which is fine but they should be seen in modal just for viewing, so that I can build my strategy when others are playing. 
6. AI players are never winning, can you make them pro-level players, enhance their skills may be not sure. 
7. Wild rent card - can you refer image for that online and make it proper. Currently difficult to recognise. 1. Please turn off the feature ending turn after 3 cards played. Let the player end the turn. 
2. Sly card or forced card is taking cards directly without showing player which cards are going. Thogh whoever is giving the card can not do anything but should inform in a modal box that particular card is leaving, so that player acknowldges. 
3. In my play area, I have my cards, but they are overlapped. can't see them, and they are like read only - can't click even. 
4. Can the player boxes be highlighted when turn comes? Currently just showing names
5. When no property or cash on table for a player skip the player awaiting payment. It will be great in awaiting payment should show who is pending. 
6. different colors Cards are getting grouped together.
7. No matter what a complete set can not be broken when paying rent, debt etc. Only Deal breaker card can take the whole set. 


---------
1. If forced deal is played its currently handling worngly. Imagine I swapped a green with blue, in property area its showing the card but in green!! Worth looking prod-server.ts line 422. 
2. When taking rent or asking payment it show all of their cards on table for me to choose. Currently it opens up modal and I can't see what their cards are in the modal. 
3. When deal breaker is played, should show alert like sly deal has. 
4. End turn button & draw card button - I accidentally clicked end and my turn was ended even I played. And the color codes can be different, yellow there isn't visible. May be can have floating buttons without blocking the view, may be can be dragged. 
5. If my turn is not there, the cards a greayed out, which is fine but they should be seen in modal just for viewing, so that I can build my strategy when others are playing. 
6. AI players are never winning, can you make them pro-level players, enhance their skills may be not sure. 
7. Wild rent card - can you refer image for that online and make it proper. Currently difficult to recognise. 


1. I played deal breaker, opponent put say no, I did not get any notification. I may have another say no to put. So, whenever anyone plays say no, other player should get to know what happened there & take next action. 
2. short pay logic needs revisit. If I have $10m, someone asks rent $1m I can't pay $1m. I have to give $10m. 
3. Cash first taken then property if cash is not there in bank when paying debt or rent. 
4. AI players have improved but they are not still very good. Unable to arrange their own cards, could not recognise wild card where they could be making a set. Only curious to get rent lol. Main goal is to make 3 sets to win. Improve them not just simple if else logic is enough i guess. 
5. Possible to add some music for moves or turn comes, timer ending, winner highlight etc?


✅ 1. Sly, Force deal is currently not being blocked if someone has say no. Its always good to ask player has say no card, and they want tplay for slay or forced deal cases. Just like we currently have deal breaker. [Fixed v1.6.0]
✅ 2. When paying rent, currently system auto selected cards in that modal. But most of the time it does wrongly. Better you do not choose anything. Let the payer decide. But first cash would go, if insuffucient properties. Applies for rent, debt and anytime payment is asked. [Fixed v1.6.0]
✅ 3. Double rent + Rent = 1 attempt out of 3 in a turn. Fix whereever applicable. The label count should not consider 2 attempts gone. [Fixed v1.6.0 - label now says "Free modifier (no extra play)"]
✅ 4. When paying rent, no player can break theit set property. If no money/non-set property they won't pay. Currently AI players giving full set property as rent!! [Fixed v1.6.0 - aiPay now skips complete sets]
✅ 5. When rooms are created, host can decide level of AI player skills, beginner, medium, advanced etc. And based on these their way of gaming must change. [Fixed v1.6.0]
