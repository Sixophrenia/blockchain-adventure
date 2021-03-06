function Game(container,contract){
    let game = {
          screens: {
              networkCheck:      ById("networkCheck"),

              welcome:      ById("welcome"),
              situation:    ById("situation"),
              loading:      ById("loading"),
              create:       ById("create"),
              confirm:      ById("confirm"),
              wait:         ById("wait"),
              sign:         ById("sign"),
              signConfirm:  ById("signConfirm"),

              learn:        ById("learn"),
          },
        create:{
              fromSituation: 0,
                fromChoice: 0,

            situationText: '',
            choices: [],
            choiceFields: [],

            closable: false,

            submit: () =>{
                //parse the input
                SetText(ById("input-error"),"");

                if(game.create.situationText.trim() === ""){
                    SetText(ById("input-error"),
                        "Error: your situation text is empty"
                    );
                    return;
                }
                for(let c = 0; c < game.create.choiceFields.length; c++){
                    let field = game.create.choiceFields[c];
                    if(field.value.length > 32){
                        SetText(ById("input-error"),
                            "Error: your choice is too long (32 char max)"
                        );
                        field.setAttribute("class","input-choice input-choice-invalid");
                        return;
                    }
                }

                if(!game.create.closable && game.create.choiceFields.length === 0){
                    SetText(ById("input-error"),
                        "Error: this is the last open pathway, so you must provide at least one choice."
                    );
                    return;
                }
                game.open_confirm();
            },
            reset: () => {
                ById("input-situation").value = "";
                game.create.choices = [];
                game.create.choiceFields.forEach( field => {
                    ById("input-choices").removeChild(field);
                });
                game.create.choiceFields = [];
            },
            add_choice: () =>{
                let input = document.createElement('INPUT');
                input.setAttribute("type","text");
                input.setAttribute("class","input-choice");

                input.addEventListener("change", event => {
                    game.create.read_choices(false);
                    event.target.setAttribute("class","input-choice");
                    SetText(ById("input-error"),"");
                });
                input.addEventListener("blur", event => {
                    game.create.read_choices(true);
                });

                game.create.choiceFields.push(input);
                ById("input-choices").appendChild(input);
                input.focus();
            },
            read_choices: (doClear) => {
                let choices = [];
                for(let i = 0; i < game.create.choiceFields.length; i++){
                    let field = game.create.choiceFields[i];
                    let value = field.value.trim();
                   if( value !== ""){
                        choices.push(value);
                   }else if(doClear){
                        ById("input-choices").removeChild(field);
                        game.create.choiceFields.splice(i--,1);
                   }
                };
                game.create.choices = choices;
            },
        },
        confirm: {
            submit: async () => {
                let transaction = await contract.add_situation(
                  game.create.fromSituation,
                  game.create.fromChoice,
                    game.create.situationText,
                    game.create.choices,
                    (transaction) => {
                        if(transaction.accepted){
                            game.wait.hash = transaction.hash;
                            game.wait.fromSituation = game.create.fromSituation;
                            game.wait.fromChoice    = game.create.fromChoice;
                            game.open_wait();
                        }
                    }
                );
            }
        },
        wait: {
            fromSituation: 0,
            fromChoice: 0,
            hash: '',
            interval: null,
            doWait: () => {
                //getting tx receipt doesn't actually matter, it's just the next situation being available which will happen as a result anyway,
                // or if someone else defines it
                game.wait.interval = setInterval( async () => {
                    const next = await contract.get_next_situation(game.wait.fromSituation,game.wait.fromChoice);
                    if(String(next) !== '0'){
                        clearInterval(game.wait.interval);
                        game.goto_next_situation(game.wait.fromSituation,game.wait.fromChoice);
                    }
                }, 1000);
            }
        },
        sign: {
              signature: '',
            submit: async() =>{
                let transaction = await contract.add_signature(
                    game.sign.signature,
                    (transaction) => {
                        if(transaction.accepted){
                            game.open_signConfirm();
                        }
                    }
                );

            }
        },

        breadCrumbs: {now:0,last:0},

        reveals: (elements /*array*/) => {
              for(let i = 0; i < elements.length; i++){
                Show(elements[i],false);
                setTimeout(()=>{
                    Show(elements[i],true);
                }, (i + 1) * 50);
              }
        },

        init: () => {
            RedrawFrames();
            window.addEventListener('resize', ()=>{
                RedrawFrames();
            });


            //Start page
            onClick(ById("start-game"),async ()=>{
                game.open_situation(0);

                //Hacky last chance way of checking they aren't entering on wrong network
                // let network = await web3.eth.net.getId();
                // if(String(network) !== '4'){ //main: 1
                //     location.reload();
                // }
            });

            ById("input-situation").addEventListener("change", event => {
                game.create.situationText = event.target.value.trim();
                SetText(ById("input-error"),"");
            });


            onClick(ById("welcome-button-metamask"), ()=>{
                game.open_learn();
            });



            //Buttons wait
            onClick(ById("wait-sign"), ()=>{
                clearInterval(game.wait.interval);
                game.open_sign();
            });
            onClick(ById("wait-restart"),()=>{
                clearInterval(game.wait.interval);
               game.start();
            });

            onClick(ById("input-add-choice"),()=>{
                game.create.add_choice();
            });
            onClick(ById("input-submit-situation"), ()=>{
                game.create.submit();
            });

            onClick(ById('confirm-button-edit'), () =>{
                game.show_screen(false);
                let screen_elements = game.screens.create.children;
                game.reveals(screen_elements);

                game.show_screen('create');
            });
            onClick(ById('confirm-button-submit'), () =>{
                game.confirm.submit();
            });


            //Signature
            ById("input-signature").addEventListener("change", event => {
                game.sign.signature = event.target.value;
            });
            onClick(ById("sign-button-cancel"),()=>{
                game.start();
            });
            onClick(ById("sign-button-submit"), ()=>{
                game.sign.submit();
            });


            onClick(ById("sign-confirm-restart"), () =>{
                clearInterval(game.wait.interval);
                game.start();
            });

            //Learn
            onClick(ById("learn-button-restart"), () =>{
               game.start();
            });
        },

        show_screen: (screen) => {
              for(let s in game.screens){
                  Show(game.screens[s],s === screen);
              }
        },
        start: async () => {
              if(!contract.check_network()){
                    let network = await web3.eth.net.getId();
                    if(String(network) !== '1'){
                        setTimeout(()=> {
                            container.style.display = "inherit";
                            game.show_screen("networkCheck");

                            let screen_elements = game.screens.networkCheck.children;
                            game.reveals(screen_elements);
                        },200);
                        return;
                    }
              }

              setTimeout(()=>{
                  container.style.display = "inherit";
                  game.show_screen("welcome");

                  Show(ById("reminder-metamask"),!contract.check_metamask());

                  let screen_elements = game.screens.welcome.children;
                  game.reveals(screen_elements);
              },200);
        },

        open_create: async(from_situation,from_choice) => {


          game.create.fromSituation = from_situation;
          game.create.fromChoice = from_choice;

            game.create.reset();
            game.show_screen("loading");

            let previous_situation = {found:false};
            while(!previous_situation.found){
                //Endless loop for load fails.. no way that can go badly
                previous_situation = await contract.get_situation(from_situation);

            }
            SetText(ById('create-prev-situation'),previous_situation.situationText);


            SetText(ById("input-error"),"");

            let prevChoices = ById('create-prev-choices');
            prevChoices.innerHTML = '';
            for(let i = 0; i < previous_situation.choiceText.length; i++){
                prevChoices.appendChild(
                    PrevChoice(previous_situation.choiceText[i],String(i) === String(from_choice))
                )
            }

            let screen_elements = game.screens.create.children;
            game.reveals(screen_elements);

            game.show_screen('create');

            game.create.closable = await contract.get_closable();
        },
        open_confirm: () => {
            game.show_screen(false);
              SetText(ById("confirm-situation"),game.create.situationText);
              if(game.create.choices.length > 0){
                  ById('confirm-choices').innerHTML = '';
                  game.create.choices.forEach( choice => {
                      ById('confirm-choices').appendChild(
                          PrevChoice(choice,false)
                      );
                  });
              }else{
                  SetText(ById('confirm-choices'),"Note: you haven't provided any choices. This means the game will end when players arrive at this point.");
              }
            let screen_elements = game.screens.confirm.children;
            game.reveals(screen_elements);

          game.show_screen('confirm');
        },

        open_learn: () => {
            game.show_screen(false);
            let screen_elements = game.screens.learn.children;
            game.reveals(screen_elements);

            game.show_screen('learn');
        },

        open_wait: () => {
            game.show_screen(false);
            let screen_elements = game.screens.wait.children;
            game.reveals(screen_elements);

            game.show_screen('wait');

            // game.wait.interval = setInterval( async ()=> {
            //     if(await web3.eth.getTransactionReceipt(game.wait.hash)){
            //         //Returns null until it returns the object below
            //         clearInterval(game.wait.interval);
            //     };
            // },1000);

            game.wait.doWait();

//             blockHash: "0xcb855c88530e3b6f4b5d16f20cbd148a61dd45d8c053ec2b14fec4202e83f093"
// ​
// blockNumber: 3717962
// ​
// contractAddress: null
// ​
// cumulativeGasUsed: 891250
// ​
// from: "0xaea13531ab3726086a02fd9254ee3dc37c876442"
// ​
// gasUsed: 95405
// ​
// logs: Array [ {…} ]
//         ​
// logsBloom: "0x00000000000002000000000000000000000000000000000000002000000000000000100000000000000000000000000000000000000000000040000000000000000000080000000000000000000000000000000000000000000000000000000008000000000000000000001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"
// ​
// status: true
// ​
// to: "0x03f5afaa886578069f86e9722949ad3e5a38ce3b"
// ​
// transactionHash: "0xb07f596f77ad9b4463c83d79b339e0d3af9c6cc96ed9b2ca95d313f39a26a76c"
// ​
// transactionIndex: 3


        },
        open_sign: () => {
              game.sign.signature = '';
            ById("input-signature").value = '';
            game.show_screen(false);
            let screen_elements = game.screens.sign.children;
            game.reveals(screen_elements);

            game.show_screen('sign');
        },
        open_signConfirm: () => {

            game.show_screen(false);
            let screen_elements = game.screens.signConfirm.children;
            game.reveals(screen_elements);
            SetText(ById("thanks-signature"),game.sign.signature);

            game.show_screen('signConfirm');

            game.wait.doWait();
        },

        open_situation: async (id) => {
            game.show_screen("loading");

            ById('situation-text').style.color = "#FFFFFF";

            let situation = {found:false};
            while(!situation.found){
                //Endless loop for load fails.. no way that can go badly
                situation = await contract.get_situation(id);
            }

            game.show_screen(false);
            //Clear Choices
            while(game.screens.situation.children.length > 4){
                let length = game.screens.situation.children.length;
                game.screens.situation.removeChild(
                    game.screens.situation.children[length - 2]
                )
            }
            //Add new choices

            for( let i = 0; i < situation.choiceText.length; i++){
                let choice_label = situation.choiceText[i];
                let length = game.screens.situation.children.length;
                let newOption = Option(choice_label);
                onClick(newOption,()=>{
                    game.goto_next_situation(id,i);
                });
                game.screens.situation.insertBefore(
                    newOption,
                    game.screens.situation.children[length - 1]
                );
            }
            if(situation.choiceText.length === 0){
                game.screens.situation.insertBefore(
                    GameOver(),
                    game.screens.situation.children[3]
                );
                let play_again = Option("Play again?");
                onClick(play_again,game.start);
                game.screens.situation.insertBefore(
                    play_again,
                    game.screens.situation.children[4]
                );
                let go_back  = Option("Take me back to the last situation");
                onClick(go_back,()=>{game.open_situation(game.breadCrumbs.last)});
                game.screens.situation.insertBefore(
                    go_back,
                    game.screens.situation.children[5]
                );
            }


            game.show_screen('situation');

                SetText(ById('situation-text'),situation.situationText);

            SetText(ById('credit-signature'),"");
            SetText(ById('credit-author'),  "");


              let screen_elements = game.screens.situation.children;
              game.reveals(screen_elements);


            let signature = await contract.get_signature(id);
            SetText(ById('credit-signature'),signature);
            let author = await contract.get_author(id);
            SetText(ById('credit-author'),author);
        },
        prompt_situation_creation: async(from_situation, from_choice) =>{
            game.show_screen(false);

            let metamasked = contract.check_metamask();

            if(metamasked){
                SetText(ById('situation-text'),
                    "It looks like nobody has decided what happens next... yet. But don't despair! You can go back to the previous situation, or if you're feeling creative, add to the story."
                );
            }else{
                SetText(ById('situation-text'),
                    "It looks like nobody has decided what happens next... yet. But don't despair! You can go back to the previous situation, or if you enable MetaMask, add to the story."
                );
            }

            ById('situation-text').style.color = "#00ffff";

            let author = "";
            let signature = "";

            //Clear Choices
            while(game.screens.situation.children.length > 4){
                let length = game.screens.situation.children.length;
                game.screens.situation.removeChild(
                    game.screens.situation.children[length - 2]
                )
            }

            let c = 3;

            //Add new choices
            let go_back  = Option("Take me back to the last situation");
            onClick(go_back,()=>{game.open_situation(from_situation)});
            game.screens.situation.insertBefore(
                go_back,
                game.screens.situation.children[c++]
            );

            if(metamasked){
                let add_situation = Option("Add to the story");
                onClick(add_situation,()=>{
                    game.open_create(from_situation,from_choice);
                });
                game.screens.situation.insertBefore(
                    add_situation,
                    game.screens.situation.children[c++]
                );
            }else{
                let add_situation = Option("Learn about Metamask");
                onClick(add_situation,()=>{
                    game.open_learn();
                });
                game.screens.situation.insertBefore(
                    add_situation,
                    game.screens.situation.children[c++]
                );
            }


            let play_again = Option("Start the game again");
            onClick(play_again,game.start);
            game.screens.situation.insertBefore(
                play_again,
                game.screens.situation.children[c++]
            )


            game.show_screen('situation');


            SetText(ById('credit-signature'),signature);
            SetText(ById('credit-author'),author);

            let screen_elements = game.screens.situation.children;
            game.reveals(screen_elements);
        },
        goto_next_situation: async (from_situation, from_choice) => {
            game.show_screen("loading");
            let next_situation = await contract.get_next_situation(from_situation,from_choice);
            if(next_situation !== '0'){
                game.breadCrumbs.last = game.breadCrumbs.now;
                game.breadCrumbs.now = next_situation;
                game.open_situation(next_situation);
            }else{
                game.prompt_situation_creation(from_situation,from_choice);
            }

        }
    };
    game.init();
    game.start();
    return game;

    function onClick(element, action){
        element.addEventListener("click", function(event){
            event.preventDefault();
            action();
        });
    }
    function Show(element,onOff){
        if(onOff){
            element.style.display = "block";
        }else{
            element.style.display = "none";
        }
    }
    function ById(id){
        return document.getElementById(id);
    }
    function SetText(element,text){
        element.innerText = text;
    }
    function Option(option_text){
        let a = document.createElement('A');
        a.setAttribute("href","");
        let div = document.createElement("DIV");
        div.setAttribute("class","option");
        div.innerText = option_text;
        a.appendChild(div);
        return a;
    }

    function PrevChoice(choice_text,selected){
        let div = document.createElement("DIV");
        if(selected){
            div.setAttribute("class","prev-option-selected");
            choice_text = "SELECTED: "+choice_text;
        }
        div.innerText = choice_text;
        return div;
    }

    function GameOver(){
        let div = document.createElement("DIV");
        div.setAttribute("class","game-over");
        div.innerText = " - Game over - ";
        return div;
    }

    function RedrawFrames(){
        const width = Math.min(800,window.innerWidth);

        const chars = Math.floor(width /ById("measurement").clientWidth * 0.75);

        let singleLine = "";
        let doubleLine = "";
        for(let c = 0; c < chars; c++){
            singleLine += "-";
            doubleLine += "=";
        }

        let singleLines = document.getElementsByClassName("frame-line");
        for(let l = 0; l < singleLines.length; l++){
            singleLines[l].innerText = singleLine;
        }
        let doubleLines = document.getElementsByClassName("frame-double-line");
        for(let l = 0; l < doubleLines.length; l++){
            doubleLines[l].innerText = doubleLine;
        }
    }
}

